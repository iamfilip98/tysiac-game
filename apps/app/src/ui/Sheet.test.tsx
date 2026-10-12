import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('is a modal dialog named by its title', () => {
    render(<Sheet title="Hello" onClose={() => {}}>body</Sheet>);
    const d = screen.getByRole('dialog', { name: 'Hello' });
    expect(d).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape and on backdrop tap, but not on sheet taps', async () => {
    const onClose = vi.fn();
    render(<Sheet title="Hello" onClose={onClose}>body</Sheet>);
    await userEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus in on open and back to the trigger on close', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          {open && <Sheet title="Hello" onClose={() => setOpen(false)}>body</Sheet>}
        </>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('Escape closes only the topmost of stacked sheets', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(<Sheet title="Outer" onClose={outer}>o</Sheet>);
    rerender(
      <>
        <Sheet title="Outer" onClose={outer}>o</Sheet>
        <Sheet title="Inner" onClose={inner}>i</Sheet>
      </>,
    );
    await userEvent.keyboard('{Escape}');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
