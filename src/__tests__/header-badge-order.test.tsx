import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../components/shared/NewGlobalHeader';
import { t } from '../i18n/translations';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

const baseAppValue = {
  filters: [],
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  activeChipFilters: [],
  showCompletionMessage: vi.fn(),
};

describe('AppHeader title-band ordering (badge row above action row)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('renders the SETTINGS badge ABOVE the action card when the action row is present', () => {
    const { container } = render(<AppHeader screen="instellingen" />);

    // Defaults: search + add (and filters) enabled → the action row exists.
    const badge = screen.getByText('SETTINGS');
    const card = container.querySelector('.app-search-card');
    expect(card).toBeInTheDocument();
    // Badge (title band) must precede the action card in DOM order.
    expect(badge.compareDocumentPosition(card as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps the title band rendered when the action row is absent (header-height regression anchor)', () => {
    const { container } = render(<AppHeader screen="instellingen" showSearch={false} showFilters={false} showAdd={false} />);

    // No empty grey action row is rendered below the badge — the badge row
    // stays at its fixed vertical position (GH header-height bug anchor).
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    expect(container.querySelector('.app-search-card')).not.toBeInTheDocument();
  });

  it('renders the sort select inside the title band ABOVE the action card', () => {
    const { container } = render(
      <AppHeader
        screen="inbox"
        sortValue="alpha"
        onSortChange={vi.fn()}
        sortOptions={[
          { value: 'alpha', label: 'A-Z' },
          { value: 'alphaDesc', label: 'Z-A' },
        ]}
      />,
    );

    const select = screen.getByRole('combobox', { name: t('common.sort') });
    const card = container.querySelector('.app-search-card');
    expect(card).toBeInTheDocument();
    // The sort select lives in the title band (badge row) and must therefore
    // come before the action card in DOM order.
    expect(select.compareDocumentPosition(card as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});