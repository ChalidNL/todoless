import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';

// Make rAF deterministic: fire callbacks on the next macrotask instead of
// depending on jsdom's pretendToBeVisual frame timing.
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
  window.setTimeout(() => cb(performance.now()), 0) as unknown as number,
);
vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Flush any rAF callbacks registered during the last act()/fireEvent batch. */
function flushRaf() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function Harness() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate('/tasks')}>
        go-tasks
      </button>
      <button type="button" onClick={() => navigate('/inbox')}>
        go-inbox
      </button>
      <AppShell bottomNav={null} toast={null}>
        <div style={{ height: '2000px' }}>route content</div>
      </AppShell>
    </div>
  );
}

describe('AppShell scroll restore', () => {
  it('restores the saved scroll position per route pathname and resets fresh routes to the top', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Harness />
      </MemoryRouter>,
    );
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    if (!main) return;

    // Scroll the /tasks route and let the save listener record it.
    act(() => {
      main.scrollTop = 320;
      fireEvent.scroll(main);
    });

    // Navigate to a route that was never visited: it must start at the top.
    fireEvent.click(screen.getByText('go-inbox'));
    await flushRaf();
    expect(main.scrollTop).toBe(0);

    // Scroll the /inbox route, then navigate back to /tasks: the saved
    // position (320) must be restored, not /inbox's position.
    act(() => {
      main.scrollTop = 120;
      fireEvent.scroll(main);
    });
    fireEvent.click(screen.getByText('go-tasks'));
    await flushRaf();
    expect(main.scrollTop).toBe(320);

    // And /inbox still remembers its own position when revisited.
    fireEvent.click(screen.getByText('go-inbox'));
    await flushRaf();
    expect(main.scrollTop).toBe(120);
  });

  it('removes the scroll listener when leaving a route so stale positions are not recorded', () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <Harness />
      </MemoryRouter>,
    );
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    if (!main) return;

    const removeSpy = vi.spyOn(main, 'removeEventListener');
    fireEvent.click(screen.getByText('go-inbox'));

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});