# Security Policy

todoless is family data software — it stores household, planning and grocery data on
your own hardware. Vulnerabilities in this project are taken seriously.

## Supported Versions

Only the **latest release** (tagged version or current `main`) is supported. Older
versions receive no security patches — please upgrade before reporting.

| Version | Supported |
|---|---|
| latest tag / `main` | ✅ |
| older tags / `dev` / feature branches | ❌ |

## Reporting a Vulnerability

**Do not open a public issue for a suspected vulnerability.** todoless uses GitHub's
private vulnerability reporting for security issues.

Report here:

https://github.com/ChalidNL/todoless/security/advisories/new

A good report includes:

- Affected version (tag or commit SHA) and how it was deployed (Docker image tag, compose, …)
- Steps to reproduce, with as little noise as possible
- Impact — what an attacker can do, and under which conditions
- (optional) a suggested fix

You will receive:

- **Acknowledgement within 48 hours** of the report
- **Triage within 5 business days** — validity and severity assessment
- **A fix as fast as severity allows**, with coordinated public disclosure once it ships
- **Credit** in the advisory and release notes, if you want it

We default to the industry-standard 90-day coordinated disclosure window, but we will
work with you to publish sooner when a fix is ready.

## Scope

In scope:

- The todoless codebase in this repository (frontend under `src/`, hooks under
  `pb_hooks/`, migrations under `pb_migrations/`, `docker-compose.yml`, `nginx.conf`,
  `pocketbase-entrypoint.sh`, build/CI files).

Out of scope (please report to the respective projects):

- Vulnerabilities in upstream dependencies (PocketBase, React, Vite, nginx, …)
- Operator misconfiguration of their own deployment
- Phishing or abuse of a specific todoless instance an operator runs

If you are unsure whether something is in scope, report it anyway — a private report
that turns out to be environmental costs very little, and a missed report can cost a lot.

## Safe harbor

Good-faith security research, private reporting, and coordinated disclosure are
explicitly welcome. We will not pursue legal action against researchers who:

- Test only against their own instance, or instances they are authorized to test
- Do not access or exfiltrate more data than is needed to demonstrate the issue
- Do not disrupt service for other users
- Report privately first, and give us a reasonable window to fix before disclosing