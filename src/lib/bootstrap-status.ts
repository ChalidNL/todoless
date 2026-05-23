export interface SetupStatus {
  hasUsers: boolean;
  setupComplete: boolean;
}

const SAFE_FALLBACK: SetupStatus = {
  hasUsers: true,
  setupComplete: false,
};

export function normalizeSetupStatus(payload: unknown): SetupStatus {
  if (!payload || typeof payload !== 'object') {
    return SAFE_FALLBACK;
  }

  const data = payload as { has_users?: unknown; setup_complete?: unknown };

  return {
    hasUsers: typeof data.has_users === 'boolean' ? data.has_users : true,
    setupComplete: typeof data.setup_complete === 'boolean' ? data.setup_complete : false,
  };
}

export async function fetchSetupStatus(
  fetcher: typeof fetch = fetch,
): Promise<SetupStatus> {
  try {
    const response = await fetcher('/api/setup-status');
    if (!response.ok) return SAFE_FALLBACK;
    return normalizeSetupStatus(await response.json());
  } catch {
    return SAFE_FALLBACK;
  }
}
