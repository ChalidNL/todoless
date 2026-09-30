import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppHeader, AddButton } from '../components/shared/NewGlobalHeader';

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

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('renders the page-level search card with filter, search and one standard add button', () => {
    const { container } = render(<AppHeader searchPlaceholder="Search calendar…" onAddEmpty={vi.fn()} type="calendar" />);

    expect(screen.getByText('todoless')).toBeInTheDocument();
    expect(container.querySelector('.app-search-card')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search calendar…')).toBeInTheDocument();
    expect(screen.getByTitle('Filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('app-fab');
  });

  it('does not render the action card when search, filters, add and input actions are all disabled', () => {
    const { container } = render(<AppHeader screen="instellingen" showSearch={false} showFilters={false} showAdd={false} />);

    // No empty grey action row — the badge row sits right below the avatar row.
    expect(container.querySelector('.app-search-card')).not.toBeInTheDocument();
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
  });

  it('removes the default search-card border in the header action row', () => {
    const { container } = render(<AppHeader />);

    const card = container.querySelector('.app-search-card');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('border-0');
  });

  it('renders removable active filter chips under the badge row and removes them on tap', () => {
    const toggleChipFilter = vi.fn();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      toggleChipFilter,
      activeChipFilters: [{ type: 'label', id: 'lbl-1', label: 'School', color: '#eab308' }],
    });

    render(<AppHeader />);

    expect(screen.getByText('School')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(toggleChipFilter).toHaveBeenCalledWith('label', 'lbl-1');
  });

  it('uses the same AddButton component for empty calendar add action', () => {
    const onAddEmpty = vi.fn();

    render(<AppHeader searchPlaceholder="Search calendar…" onAddEmpty={onAddEmpty} type="calendar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAddEmpty).toHaveBeenCalledTimes(1);
  });

  it('gives explicit feedback when plus is clicked without a title', () => {
    const onAdd = vi.fn();
    const showCompletionMessage = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, showCompletionMessage });

    render(<AppHeader searchPlaceholder="Search tasks…" onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(showCompletionMessage).toHaveBeenCalledWith('Title is required');
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search tasks…'));
  });

  it('does not create a task when Enter is pressed in the search field', () => {
    const onAdd = vi.fn();
    const onSubmitInput = vi.fn();

    render(<AppHeader searchPlaceholder="Search…" onAdd={onAdd} onSubmitInput={onSubmitInput} />);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.change(input, { target: { value: 'EnterTaken' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).not.toHaveBeenCalled();
    expect(onSubmitInput).not.toHaveBeenCalled();
    expect(input).toHaveValue('EnterTaken');
  });

  it('creates a task via the plus button with text and clears the input', () => {
    const onAdd = vi.fn();

    render(<AppHeader searchPlaceholder="Search…" onAdd={onAdd} />);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.change(input, { target: { value: 'PlusTaken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith('PlusTaken');
    expect(input).toHaveValue('');
  });
});

describe('AddButton', () => {
  it('has one shared visual shape', () => {
    render(<AddButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('app-fab');
  });
});
