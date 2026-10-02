#!/usr/bin/env python3
"""Pin docker-compose.yml to published todoless images by digest.

    python3 scripts/pin-release-images.py <ref>      # rewrite docker-compose.yml
    python3 scripts/pin-release-images.py --check    # verify the current pins

<ref> is an image tag that docker-publish.yml published: a release version
(1.0.1), or the 40-character commit sha of a main build. For both images the
multi-arch index digest is resolved from GHCR (anonymous pull token, no docker
needed) and the image's org.opencontainers.image.revision label is read, so
the commit that was actually built is printed next to the pin. Compose then
references `ghcr.io/chalidnl/<image>:<ref>@sha256:<digest>` - immutable, and
still readable (#263, GH#47).

--check resolves the pins that are in docker-compose.yml now and prints
their revision; it exits 1 when a pin does not resolve or the two images
were built from different commits.
"""
import json
import re
import sys
import urllib.error
import urllib.request

REGISTRY = "https://ghcr.io"
OWNER = "chalidnl"
IMAGES = ("todoless-frontend", "todoless-pocketbase")
COMPOSE = "docker-compose.yml"
ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


def token(repo: str) -> str:
    with urllib.request.urlopen(f"{REGISTRY}/token?scope=repository:{repo}:pull", timeout=30) as r:
        return json.load(r)["token"]


def fetch(url: str, tok: str, accept: str, method: str = "GET"):
    req = urllib.request.Request(url, method=method, headers={"Authorization": f"Bearer {tok}", "Accept": accept})
    return urllib.request.urlopen(req, timeout=60)


def resolve(image: str, ref: str) -> dict:
    """Index digest + the revision label of the amd64 image for <image>:<ref>."""
    repo = f"{OWNER}/{image}"
    tok = token(repo)
    try:
        head = fetch(f"{REGISTRY}/v2/{repo}/manifests/{ref}", tok, ACCEPT, method="HEAD")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"{repo}:{ref}: not found on GHCR (HTTP {exc.code}) - was it published?") from exc
    digest = head.headers["Docker-Content-Digest"]
    index = json.load(fetch(f"{REGISTRY}/v2/{repo}/manifests/{digest}", tok, ACCEPT))
    manifests = index.get("manifests") or [{"digest": digest, "mediaType": index.get("mediaType", "")}]
    chosen = next((m for m in manifests if m.get("platform", {}).get("architecture") == "amd64"), manifests[0])
    manifest = json.load(fetch(f"{REGISTRY}/v2/{repo}/manifests/{chosen['digest']}", tok, chosen.get("mediaType", ACCEPT)))
    config = json.load(fetch(f"{REGISTRY}/v2/{repo}/blobs/{manifest['config']['digest']}", tok, "*/*"))
    labels = (config.get("config") or {}).get("Labels") or {}
    return {
        "image": image,
        "ref": ref,
        "digest": digest,
        "revision": labels.get("org.opencontainers.image.revision", ""),
        "created": labels.get("org.opencontainers.image.created", ""),
    }


LINE = re.compile(r"^(\s*image:\s*)ghcr\.io/chalidnl/(todoless-frontend|todoless-pocketbase)(?::([^@\s]+))?(?:@(sha256:[0-9a-f]{64}))?\s*$")


def current_pins(text: str) -> dict:
    pins = {}
    for line in text.splitlines():
        m = LINE.match(line)
        if m:
            pins[m.group(2)] = {"ref": m.group(3) or "latest", "digest": m.group(4)}
    return pins


def main(argv) -> int:
    if len(argv) != 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    text = open(COMPOSE, encoding="utf-8").read()

    if argv[1] == "--check":
        pins = current_pins(text)
        if set(pins) != set(IMAGES):
            print(f"{COMPOSE}: expected image lines for {IMAGES}, found {sorted(pins)}", file=sys.stderr)
            return 1
        revisions = set()
        ok = True
        for image in IMAGES:
            pin = pins[image]
            if not pin["digest"]:
                print(f"{image}: not pinned by digest ({pin['ref']})", file=sys.stderr)
                ok = False
                continue
            info = resolve(image, pin["digest"])
            revisions.add(info["revision"])
            print(f"{image}:{pin['ref']}@{pin['digest'][:19]}... -> revision {info['revision'][:12]} built {info['created']}")
        if len(revisions) > 1:
            print(f"the two images were built from different commits: {sorted(revisions)}", file=sys.stderr)
            ok = False
        return 0 if ok else 1

    ref = argv[1]
    infos = [resolve(image, ref) for image in IMAGES]
    revisions = {i["revision"] for i in infos}
    if len(revisions) > 1:
        print(f"refusing: {ref} points at different builds per image: {revisions}", file=sys.stderr)
        return 1
    out = []
    for line in text.splitlines(keepends=True):
        m = LINE.match(line)
        if m:
            info = next(i for i in infos if i["image"] == m.group(2))
            out.append(f"{m.group(1)}ghcr.io/chalidnl/{info['image']}:{ref}@{info['digest']}\n")
        else:
            out.append(line)
    open(COMPOSE, "w", encoding="utf-8").write("".join(out))
    for info in infos:
        print(f"{info['image']}:{ref}@{info['digest']}  (revision {info['revision'][:12]}, built {info['created']})")
    print(f"{COMPOSE} updated - commit it together with the release.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
