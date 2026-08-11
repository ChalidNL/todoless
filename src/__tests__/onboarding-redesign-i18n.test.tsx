import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('persists an authenticated users language before switching the UI', async () => {
    let resolveUpdate!: (value: unknown) => void;
    vi.spyOn(api, 'updateUser').mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve; }));
    authStore.record = { id: 'member-1', language: 'en' };
    authStore.isValid = true;

    render(
      <LanguageProvider>
        <LanguageProbe />
        <Onboarding mode="user" onComplete={vi.fn()} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nederlands/i }));
    expect(screen.getByText('en', { selector: 'output' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();

    resolveUpdate({ id: 'member-1', language: 'nl' });
    await waitFor(() => expect(screen.getByText('nl', { selector: 'output' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Volgende' })).toBeEnabled();
  });

  it('keeps user onboarding retryable when completion persistence fails', async () => {
    const onComplete = vi.fn();
    const markSeen = vi.spyOn(api, 'markOnboardingSeen')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    authStore.record = { id: 'member-1', language: 'en' };
    authStore.isValid = true;

    render(
      <LanguageProvider>
        <Onboarding mode="user" onComplete={onComplete} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(markSeen).toHaveBeenCalledTimes(2);
  });

  it('times out a hanging onboarding completion instead of trapping the user', async () => {
    vi.useFakeTimers();
    vi.spyOn(api, 'markOnboardingSeen').mockReturnValue(new Promise(() => undefined));
    authStore.record = { id: 'member-1', language: 'en' };
    authStore.isValid = true;

    render(
      <LanguageProvider>
        <Onboarding mode="user" onComplete={vi.fn()} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save');
    vi.useRealTimers();
  });

  it('retries only first-admin completion after registration already succeeded', async () => {
    const registerAdmin = vi.spyOn(api, 'registerAdmin').mockImplementation(async () => {
      authStore.record = { id: 'admin-1', language: 'en' };
      authStore.isValid = true;
      return { token: 'test-token', user: authStore.record } as never;
    });
    const markSeen = vi.spyOn(api, 'markOnboardingSeen')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);

    render(
      <LanguageProvider>
        <Onboarding mode="admin" onComplete={vi.fn()} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /English/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: /Discover/i }));
    await screen.findByText('Capture and finish what matters.');
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    fireEvent.click(await screen.findByRole('button', { name: /Get Started/i }));

    fireEvent.change(await screen.findByLabelText('Workspace name'), { target: { value: 'Ada family' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(await screen.findByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    expect(await screen.findByRole('heading', { name: /ready/i })).toBeInTheDocument();
    expect(registerAdmin).toHaveBeenCalledTimes(1);
    expect(markSeen).toHaveBeenCalledTimes(2);
  });

  it('uses i18n keys for every bottom navigation label', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

    for (const key of ['nav.inbox', 'nav.tasks', 'nav.calendar', 'nav.groceries', 'nav.settings']) {
      expect(app).toContain(`t('${key}', language)`);
    }
    expect(app).not.toMatch(/label:\s*'(?:Taken|Agenda|Instellingen|Boodschappen)'/);
  });
});
