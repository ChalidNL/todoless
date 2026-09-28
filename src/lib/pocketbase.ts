import PocketBase from 'pocketbase';

const resolvePocketBaseUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_POCKETBASE_URL ||
    (window as any).ENV_POCKETBASE_URL ||
    '';

  if (typeof window !== 'undefined') {
    if (!configuredUrl) {
      return window.location.origin;
    }

    if (/^https?:\/\/pocketbase(?::\d+)?$/i.test(configuredUrl) || /^pocketbase(?::\d+)?$/i.test(configuredUrl)) {
      return window.location.origin;
    }

    return configuredUrl;
  }

  return configuredUrl || 'http://localhost:8090';
};

const pbUrl = resolvePocketBaseUrl();

// Create a single PocketBase client instance
export const pb = new PocketBase(pbUrl);

// Enable auto cancellation for duplicate requests
pb.autoCancellation(false);

