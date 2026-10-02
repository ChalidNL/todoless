import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const confirmPasswordReset = vi.fn().mockResolvedValue(true);
vi.mock('../lib/pocketbase', () => ({ pb: { collection: () => ({ confirmPasswordReset }) } }));

import { ResetPassword } from '../components/ResetPassword';

describe('ResetPassword (#68)', () => {
  it('a reset link opened on the already-open page submits the NEW token and cleans the URL', async () => {
    window.history.replaceState({}, '', '/reset-password');
    render(<ResetPassword token="first-token" onDone={() => {}} />);
    window.history.replaceState({}, '', '/reset-password#token=second-token');
    await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(window.location.hash).toBe('');
    const fields = document.querySelectorAll('input[type=password]');
    fireEvent.change(fields[0], { target: { value: 'Brand-New-Passw0rd' } });
    fireEvent.change(fields[1], { target: { value: 'Brand-New-Passw0rd' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save new password/i })); });
    expect(confirmPasswordReset).toHaveBeenCalledWith('second-token', 'Brand-New-Passw0rd', 'Brand-New-Passw0rd');
  });
});
