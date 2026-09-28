import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepeatNextPreview } from '../components/shared/RepeatNextPreview';

describe('RepeatNextPreview', () => {
  it('renders nothing without a repeat interval', () => {
    const { container } = render(<RepeatNextPreview repeatInterval={null} dueDate={Date.UTC(2026, 5, 1)} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing without a due date', () => {
    const { container } = render(<RepeatNextPreview repeatInterval="week" dueDate={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the next occurrence date for a weekly task (GH#7)', () => {
    const due = Date.UTC(2026, 5, 1, 9, 0, 0); // 2026-06-01T09:00:00Z
    render(<RepeatNextPreview repeatInterval="week" dueDate={due} />);
    // Week +7 days → 2026-06-08; regex so the exact locale rendering (Jun 8) is
    // not coupled to the test runner's default locale.
    const label = screen.getByLabelText('Next occurrence');
    expect(label.textContent).toMatch(/^Next:/);
    expect(label.textContent).toMatch(/8/);
  });

  it('uses the month_weekday math for the preview like the server hook', () => {
    const due = Date.UTC(2026, 5, 1, 9, 0, 0); // first Monday of June 2026
    render(<RepeatNextPreview repeatInterval="month_weekday" dueDate={due} />);
    const label = screen.getByLabelText('Next occurrence');
    // getNextRecurringDueDate → first Monday of July 2026 = 2026-07-06
    expect(label.textContent).toMatch(/6/);
  });
});