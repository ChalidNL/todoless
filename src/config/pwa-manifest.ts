interface PwaManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  display_override: string[];
  orientation: string;
  background_color: string;
  theme_color: string;
  categories: string[];
  screenshots: Array<{ src: string; sizes: string; type: string }>;
  launch_handler: { client_mode: string };
  icons: PwaManifestIcon[];
}

export interface PwaManifestOptions {
  isBeta: boolean;
  iconDir: string;
  appName: string;
  appShort: string;
}

export function buildPwaManifest(opts: PwaManifestOptions): PwaManifest {
  return {
    // Stable identity so a future start_url change never forks the install.
    id: '/',
    name: opts.appName,
    short_name: opts.appShort,
    // i18n-ignore: PWA install-tip metadata is intentionally English product copy (not UI chrome)
    description: opts.isBeta ? 'Self-hosted productivity app (beta)' : 'The self-hosted family organizer for tasks, calendar and groceries',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#f8f7ff',
    theme_color: '#f8f7ff',
    categories: ['productivity', 'utilities'],
    screenshots: [],
    launch_handler: { client_mode: 'navigate-existing' },
    // Generated from the official logo by scripts/generate-icons.js. Maskable
    // variants keep the whole mark inside the 40% safe-zone radius on an opaque
    // background so launcher masks neither clip nor shrink it.
    icons: [
      { src: `${opts.iconDir}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${opts.iconDir}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${opts.iconDir}/icon-192-maskable.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: `${opts.iconDir}/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}