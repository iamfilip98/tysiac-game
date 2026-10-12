import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RULES } from '@tysiac/engine';
import { RulesSheet } from './RulesSheet';
import { loadLang } from '../i18n';

describe('RulesSheet in other languages', () => {
  it('rules use musik and meldunek in Polish, and numbers from RULES', async () => {
    await loadLang('pl');
    render(<RulesSheet onClose={vi.fn()} />);
    const text = screen.getByRole('dialog', { name: 'Zasady' }).textContent!;
    expect(text).toMatch(/musik/i);
    expect(text).toMatch(/meldun/i);
    expect(text).toContain(String(RULES.winAt));
    expect(text).toContain(`${RULES.barrelAt}–${RULES.winAt - 1}`);
    expect(text).toContain('na beczce');
    // Polish rank letters: dama = D, walet = W
    expect(text).toContain('A > 10 > K > D > W > 9');
  });
  it('Danish rules and the talon confirmation rule', async () => {
    await loadLang('da');
    render(<RulesSheet onClose={vi.fn()} />);
    const text = screen.getByRole('dialog', { name: 'Regler' }).textContent!;
    expect(text).toContain('E > 10 > K > D > B > 9');
    expect(text).toContain('bekræfter med Set');
  });
  it('English describes the talon confirmation', () => {
    render(<RulesSheet onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Rules' }).textContent).toContain('everyone sees the talon and confirms with Seen');
  });
});
