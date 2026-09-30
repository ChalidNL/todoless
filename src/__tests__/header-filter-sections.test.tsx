import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('AppHeader filter dropdown hideDateRepeatSections behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('omits the Due date and Repeat sections when hideDateRepeatSections is set (calendar screens)', () => {
    render(<AppHeader screen="agenda" hideDateRepeatSections searchPlaceholder={t('calendar.searchPlaceholder')} />);

    fireEvent.click(screen.getByRole('button', { name: t('common.filtersTooltip') }));

    // Status sections still apply to the calendar model…
    expect(screen.getByText(t('dashboard.todoSprint'))).toBeInTheDocument();
    // …but date-preset and repeat sections are hidden.
    expect(screen.queryByText(t('filters.dueDate'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('repeat.repeat'))).not.toBeInTheDocument();
  });

  it('keeps the Due date and Repeat sections when hideDateRepeatSections is not set (default)', () => {
    render(<AppHeader screen="taken" />);

    fireEvent.click(screen.getByRole('button', { name: t('common.filtersTooltip') }));

    expect(screen.getByText(t('filters.dueDate'))).toBeInTheDocument();
    expect(screen.getByText(t('repeat.repeat'))).toBeInTheDocument();
  });
});