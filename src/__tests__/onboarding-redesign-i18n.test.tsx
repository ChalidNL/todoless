import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SupportedUiLanguage } from '../i18n/translations';

const authStore = vi.hoisted(() => ({
  record: null as null | Record<string, unknown>,
  token: 'test-token',
  isValid: false,
  onChange: vi.fn(() => () => undefined),
  clear: vi.fn(),
}));
const authWithPassword = vi.hoisted(() => vi.fn());
const updateAppSettings = vi.hoisted(() => vi.fn());

vi.mock('../lib/pocketbase', () => ({
  pb: {
    authStore,
    collection: vi.fn(() => ({ authWithPassword })),
  },
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ updateAppSettings }),
}));

import { Onboarding } from '../components/Onboarding';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { api } from '../lib/pocketbase-client';
import { setActiveLanguage, t } from '../i18n/translations';

function LanguageProbe() {
  const { language } = useLanguage();
  return <output>{language}</output>;
}

const memoryStorage = (() => {
  let values: Record<string, string> = {};
  return {
    clear: () => { values = {}; },
    getItem: (key: string) => values[key] ?? null,
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
    removeItem: (key: string) => { delete values[key]; },
    setItem: (key: string, value: string) => { values[key] = String(value); },
  } as Storage;
})();

describe('red onboarding visual and localization contract', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage);
    localStorage.clear();
    authStore.record = null;
    authStore.isValid = false;
    authWithPassword.mockReset();
    updateAppSettings.mockReset();
    setActiveLanguage('en');
    vi.restoreAllMocks();
  });

  it('starts with language selection and switches the following onboarding UI immediately', async () => {
    const { container } = render(
      <LanguageProvider>
        <Onboarding mode="info" onComplete={vi.fn()} />
      </LanguageProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Choose your language' })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('onboarding-shell', 'onboarding-theme-language');

    fireEvent.click(screen.getByRole('button', { name: /Nederlands/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volgende' }));

    expect(await screen.findByRole('heading', { name: 'Welkom bij todoless' })).toBeInTheDocument();
    expect(localStorage.getItem('app_language')).toBe('nl');
    expect(document.documentElement.lang).toBe('nl');
  });

  it('defines guaranteed red onboarding CSS and responsive contracts without generated utilities', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const onboarding = readFileSync(resolve(__dirname, '../components/Onboarding.tsx'), 'utf8');

    expect(css).toMatch(/\.onboarding-shell\s*\{/);
    expect(css).toMatch(/\.onboarding-theme-language\s*\{[^}]*background:/s);
    expect(css).toMatch(/linear-gradient\([^)]*var\(--app-primary/s);
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('@media (min-width: 1440px)');
    expect(onboarding).not.toMatch(/from-violet-600|via-purple-600|bg-white\/15|text-white\/70/);
  });

  it('has complete onboarding copy in every launch language', () => {
    const keys = [
      'onboarding.welcomeDescription',
      'onboarding.discoverFeatures',
      'onboarding.showcaseHint',
      'onboarding.workspaceDescription',
      'onboarding.accountDescription',
      'onboarding.doneAdminTitle',
      'onboarding.doneInfoDescription',
    ];

    for (const language of ['en', 'nl', 'fr', 'de', 'es'] as SupportedUiLanguage[]) {
      for (const key of keys) {
        expect(t(key, language), `${language}:${key}`).not.toBe(key);
      }
    }
  });

  it('passes the selected language when creating the first admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'admin-1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    authStore.record = { id: 'admin-1', email: 'admin@example.com', language: 'nl' };
    authStore.isValid = true;
    authWithPassword.mockResolvedValue({ record: authStore.record });

    await api.registerAdmin('admin@example.com', 'password123', 'Ada Admin', 'Ada family', 'nl');

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.language).toBe('nl');
  });

  it('restores the authenticated users language after login instead of the stale local preference', async () => {
    localStorage.setItem('app_language', 'en');
    authStore.record = { id: 'admin-1', language: 'nl' };
    authStore.isValid = true;

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(screen.getByText('nl')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('app_language')).toBe('nl'));
  });

  it('uses i18n keys for every bottom navigation label', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

    for (const key of ['nav.inbox', 'nav.tasks', 'nav.calendar', 'nav.groceries', 'nav.settings']) {
      expect(app).toContain(`t('${key}', language)`);
    }
    expect(app).not.toMatch(/label:\s*'(?:Taken|Agenda|Instellingen|Boodschappen)'/);
  });
});
