export interface AppVersionInfo {
  version: string;
  commit: string;
  buildId?: string;
}

export function normalizeCommit(commit?: string | null): string {
  const normalized = String(commit ?? '').trim();
  if (!normalized) return '';
  if (normalized === 'local') return 'local';
  return normalized.slice(0, 7);
}

export function normalizeBuildId(buildId?: string | null): string {
  return String(buildId ?? '').trim();
}

export function getNormalizedAppVersion(value?: Partial<AppVersionInfo> | null): AppVersionInfo {
  return {
    version: String(value?.version ?? '').trim(),
    commit: normalizeCommit(value?.commit),
    buildId: normalizeBuildId(value?.buildId),
  };
}

export function shouldShowUpdateButton(
  currentVersion?: Partial<AppVersionInfo> | null,
  remoteVersion?: Partial<AppVersionInfo> | null
): boolean {
  const current = getNormalizedAppVersion(currentVersion);
  const remote = getNormalizedAppVersion(remoteVersion);

  if (!remote.version && !remote.commit && !remote.buildId) return false;

  if (remote.buildId && current.buildId) {
    return current.buildId !== remote.buildId;
  }

  if (remote.commit && current.commit && remote.commit !== 'local' && current.commit !== 'local') {
    return current.commit !== remote.commit;
  }

  return false;
}

export async function fetchLatestAppVersion(fetchImpl: typeof fetch = fetch): Promise<AppVersionInfo | null> {
  try {
    const response = await fetchImpl(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as Partial<AppVersionInfo>;
    const normalized = getNormalizedAppVersion(payload);

    if (!normalized.version && !normalized.commit && !normalized.buildId) return null;
    return normalized;
  } catch {
    return null;
  }
}

function getCurrentAppRegistration(
  registrations: readonly ServiceWorkerRegistration[]
): ServiceWorkerRegistration | undefined {
  const currentPath = window.location.pathname;

  return registrations.find((registration) => {
    const scopePath = new URL(registration.scope).pathname;
    return currentPath.startsWith(scopePath);
  });
}

export async function forceRefreshApp(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const currentRegistration = getCurrentAppRegistration(registrations);

    if (currentRegistration) {
      await currentRegistration.unregister();
    }
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('app-update', Date.now().toString());
  window.location.replace(nextUrl.toString());
}
