
import { execSync } from 'node:child_process';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

function getBuildCommit(): string {
  const envCommit = process.env.VITE_GIT_COMMIT?.trim();
  if (envCommit) return envCommit.slice(0, 7);

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
}

const BUILD_VERSION = process.env.VITE_APP_VERSION || 'dev';
const BUILD_COMMIT = getBuildCommit();
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_ID = `${BUILD_VERSION}-${BUILD_COMMIT}-${BUILD_TIMESTAMP}`;
const IS_BETA = process.env.VITE_BETA === 'true' || process.env.TODOLESS_TAG === 'pre' || process.env.TODOLESS_TAG === 'beta';
const ICON_DIR = IS_BETA ? '/icons-beta' : '/icons';
const APP_NAME = IS_BETA ? 'todoless β' : 'todoless';
const APP_SHORT = IS_BETA ? 'todoless β' : 'todoless';

function buildVersionAsset(): PluginOption {
  return {
    name: 'build-version-asset',
    apply: 'build' as const,
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            version: BUILD_VERSION,
            commit: BUILD_COMMIT,
            buildId: BUILD_ID,
          },
          null,
          2
        ),
      });
    },
  };
}

function betaIconTransform(): PluginOption {
  if (!IS_BETA) return { name: 'beta-icon-transform', apply: 'build' as const };
  return {
    name: 'beta-icon-transform',
    apply: 'build' as const,
    transformIndexHtml(html) {
      return html
        .replace(/\/icons\//g, '/icons-beta/')
        .replace(/\/favicon\.svg/g, '/icons-beta/favicon.svg')
        .replace(/apple-mobile-web-app-title" content="todoless"/, 'apple-mobile-web-app-title" content="todoless β"')
        .replace(/<title>todoless<\/title>/, '<title>todoless β</title>');
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
    __APP_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    buildVersionAsset(),
    betaIconTransform(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        `${ICON_DIR}/icon-192.svg`, `${ICON_DIR}/icon-512.svg`,
        `${ICON_DIR}/icon-192.png`, `${ICON_DIR}/icon-512.png`,
        `${ICON_DIR}/icon-512-maskable.png`,
        IS_BETA ? 'logo-rainbow-beta.png' : 'logo-rainbow.png',
      ],
      manifest: {
        name: APP_NAME,
        short_name: APP_SHORT,
        description: IS_BETA ? 'Self-hosted productivity app (beta)' : 'Self-hosted multi-user task manager',
        theme_color: '#f8f7ff',
        background_color: '#f8f7ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: `${ICON_DIR}/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${ICON_DIR}/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${ICON_DIR}/icon-512-maskable.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}']
      }
    })
  ],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      port: 7071,
      proxy: {
        '/api/': {
          target: 'http://localhost:8091',
          changeOrigin: true,
        },
      },
    },
  });