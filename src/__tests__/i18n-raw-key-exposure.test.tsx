import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SUPPORTED_UI_LANGUAGES, setActiveLanguage, t } from '../i18n/translations';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

import { AppHeader } from '../components/shared/NewGlobalHeader';
import { CompactItemCard } from '../components/shared/CompactItemCard';

const baseAppValue = {
  filters: [],
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  isChipFilterActive: vi.fn(() => false),
  activeChipFilters: [],
  addFilter: vi.fn(),
  showCompletionMessage: vi.fn(),
  users: [],
  appSettings: {},
  shops: [],
  createShop: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  convertItemToTask: vi.fn(),
};

const item = {
  id: 'item-1',
  title: 'Milk',
  quantity: 2,
  completed: false,
  labels: [],
} as any;

/**
 * GH#80 / CERT2-L10N-001/002/003 — raw dotted i18n keys were reaching the DOM as
 * aria-labels and visible text, and some labels were hardcoded English.
 *
 * Ported from d04460e (side branch fix/rate-limit-header-spoofing-2026-09-27).
 * The sweeping "every t() key resolves" scan is intentionally NOT ported: the
 * remaining unresolved keys (onboarding placeholders, common.saved,
 * settings.membersSearchPlaceholder) belong to other side-branch commits and
 * are tracked as a follow-up kanban task.
 */
describe('localized aria-labels and stat labels (GH#80 / CERT2-L10N-001/002/003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveLanguage('en');
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('labels the sort select with translated text, not the raw common.sort key (en)', () => {
    setActiveLanguage('en');
    render(
      <AppHeader
        screen="taken"
        sortValue="alpha"
        onSortChange={vi.fn()}
        sortOptions={[{ value: 'alpha', label: 'A-Z' }]}
      />,
    );

    expect(screen.queryByLabelText('common.sort')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();
  });

  it('labels the sort select with translated text in Dutch', () => {
    setActiveLanguage('nl');
    render(
      <AppHeader
        screen="taken"
        sortValue="alpha"
        onSortChange={vi.fn()}
        sortOptions={[{ value: 'alpha', label: 'A-Z' }]}
      />,
    );

    expect(screen.queryByLabelText('common.sort')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sorteren')).toBeInTheDocument();
  });

  it('labels grocery quantity steppers with translated text (en)', () => {
    setActiveLanguage('en');
    render(<CompactItemCard item={item} />);

    expect(screen.queryByLabelText('items.decreaseQuantity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('items.increaseQuantity')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Decrease quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase quantity')).toBeInTheDocument();
  });

  it('labels grocery quantity steppers with translated text (nl)', () => {
    setActiveLanguage('nl');
    render(<CompactItemCard item={item} />);

    expect(screen.queryByLabelText('items.decreaseQuantity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('items.increaseQuantity')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Aantal verlagen')).toBeInTheDocument();
    expect(screen.getByLabelText('Aantal verhogen')).toBeInTheDocument();
  });

  it('translates the calendar schedule view option in every locale', () => {
    // nl previously fell through to the literal English 'Schedule' while its
    // siblings (Dag / 3 dagen / Week / Werkweek / Maand) were translated.
    expect(t('calendar.schedule', 'nl')).toBe('Agenda');
    expect(t('calendar.schedule', 'nl')).not.toBe(t('calendar.schedule', 'en'));
    for (const lang of SUPPORTED_UI_LANGUAGES) {
      expect(t('calendar.schedule', lang)).not.toBe('calendar.schedule');
    }
  });

  it('translates inbox stat-card labels instead of leaving English in Dutch', () => {
    for (const key of ['dashboard.inbox', 'dashboard.todoSprint', 'dashboard.doneSprint', 'dashboard.blocked']) {
      for (const lang of SUPPORTED_UI_LANGUAGES) {
        expect(t(key, lang)).not.toBe(key);
      }
      // Dutch must not silently reuse the English string.
      expect(t(key, 'nl')).not.toBe(t(key, 'en'));
    }
    expect(t('dashboard.inbox', 'nl')).toBe('Postvak IN');
    expect(t('dashboard.todoSprint', 'nl')).toBe('Te doen sprint');
    expect(t('dashboard.doneSprint', 'nl')).toBe('Afgeronde sprint');
    expect(t('dashboard.blocked', 'nl')).toBe('Geblokkeerd');
  });
});