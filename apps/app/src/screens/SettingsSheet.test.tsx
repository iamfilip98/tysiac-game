import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '@tysiac/engine';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
import { MenuSheet } from './MenuSheet';
import { ProfileForm } from '../ui/ProfileForm';
import { usePrefs } from '../store/prefs';

beforeEach(() => usePrefs.setState({ name: 'Filip', avatar: '🦊', theme: 'brass', sound: true, coach: null, speed: 'normal', lang: 'en' }));

describe('SettingsSheet', () => {
  it('switches theme, sound and speed', async () => {
    render(<SettingsSheet allowProfile={false} coachOn onRules={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('radio', { name: /Midnight/ }));
    expect(usePrefs.getState().theme).toBe('midnight');
    expect(document.documentElement.dataset.theme).toBe('midnight');
    await userEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(usePrefs.getState().sound).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: 'Fast' }));
    expect(usePrefs.getState().speed).toBe('fast');
  });

  it('turning the coach off is stored and reported', async () => {
    const onCoachChange = vi.fn();
    render(<SettingsSheet allowProfile={false} coachOn onCoachChange={onCoachChange} onRules={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Coach hints' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('switch', { name: 'Coach hints' }));
    expect(usePrefs.getState().coach).toBe(false);
    expect(onCoachChange).toHaveBeenCalledWith(false);
  });

  it('shows the profile form only when allowed', async () => {
    const { unmount } = render(<SettingsSheet allowProfile={false} coachOn={false} onRules={() => {}} onClose={() => {}} />);
    expect(screen.queryByLabelText('Your name')).toBeNull();
    unmount();
    render(<SettingsSheet allowProfile coachOn={false} onRules={() => {}} onClose={() => {}} />);
    const input = screen.getByLabelText('Your name');
    await userEvent.clear(input);
    await userEvent.type(input, '  Ola  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(usePrefs.getState().name).toBe('Ola');
  });

  it('switches language instantly and stays open (review focus 5)', async () => {
    render(<SettingsSheet allowProfile={false} coachOn={false} onRules={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Polski' }));
    expect(await screen.findByRole('dialog', { name: 'Ustawienia' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Polski' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Dźwięk' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Dansk' }));
    expect(await screen.findByRole('dialog', { name: 'Indstillinger' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(usePrefs.getState().lang).toBe('en');
  });

  it('picks among six themes, each a live preview in its own tokens', async () => {
    render(<SettingsSheet allowProfile={false} coachOn={false} onRules={() => {}} onClose={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    for (const name of ['Brass & Baize', 'Wycinanki', 'Bolesławiec', 'Zakopane', 'Noir', 'Midnight']) within(group).getByRole('radio', { name });
    expect(group.querySelectorAll('.tpick__scene[data-theme]')).toHaveLength(6);
    await userEvent.click(screen.getByRole('radio', { name: 'Zakopane' }));
    expect(usePrefs.getState().theme).toBe('zakopane');
    expect(document.documentElement.dataset.theme).toBe('zakopane');
  });

  it('arrow keys move through radios (roving focus) and switches toggle with Space', async () => {
    render(<SettingsSheet allowProfile={false} coachOn={false} onRules={() => {}} onClose={() => {}} />);
    const normal = screen.getByRole('radio', { name: 'Normal' });
    expect(normal).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Fast' })).toHaveAttribute('tabindex', '-1');
    normal.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(usePrefs.getState().speed).toBe('fast');
    expect(screen.getByRole('radio', { name: 'Fast' })).toHaveFocus();
    const brass = screen.getByRole('radio', { name: 'Brass & Baize' });
    brass.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(usePrefs.getState().theme).toBe('midnight');
    expect(screen.getByRole('radio', { name: 'Midnight' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(usePrefs.getState().theme).toBe('brass');
    const sound = screen.getByRole('switch', { name: 'Sound' });
    sound.focus();
    await userEvent.keyboard(' ');
    expect(usePrefs.getState().sound).toBe(false);
    expect(sound).toHaveAttribute('aria-checked', 'false');
  });

  it('the coach switch describes itself', () => {
    render(<SettingsSheet allowProfile={false} coachOn onRules={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Coach hints' })).toHaveAccessibleDescription('A gold arrow and a tip on your turn');
  });

  it('opens the rules', async () => {
    const onRules = vi.fn();
    render(<SettingsSheet allowProfile={false} coachOn={false} onRules={onRules} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Rules' }));
    expect(onRules).toHaveBeenCalledOnce();
  });
});

describe('RulesSheet', () => {
  it('states the rule numbers from RULES', () => {
    render(<RulesSheet onClose={() => {}} />);
    const text = screen.getByRole('dialog', { name: 'Rules' }).textContent!;
    expect(text).toContain(`${RULES.maxBidBase} + your marriages`);
    expect(text).toContain(`${RULES.barrelAt}–${RULES.winAt - 1}`);
    expect(text).toContain(`First to ${RULES.winAt} wins`);
    expect(text).toContain('♥\uFE0E 100');
    expect(text).toContain('Only the first player after the leader must also beat the lead card');
  });

  it('matches the house rules on rounding, bidding and barrel', () => {
    render(<RulesSheet onClose={() => {}} />);
    const text = screen.getByRole('dialog', { name: 'Rules' }).textContent!;
    expect(text).toContain(`a remainder of ${RULES.roundUpFrom} or more rounds up`);
    expect(text).toContain(`bid exactly ${RULES.bidStep} more`);
    expect(text).toContain('Bidding ends when two players have passed');
    expect(text).toContain('minus the bid');
    expect(text).toContain('defenders score 0');
    expect(text).toContain('no obligation to trump');
    expect(text).toContain('There is no limit on barrel attempts');
  });
});

describe('MenuSheet', () => {
  it('offers pause or resume', async () => {
    const onPause = vi.fn();
    const { unmount } = render(<MenuSheet paused={false} onPause={onPause} onResume={() => {}} onSettings={() => {}} onRules={() => {}} onLeave={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pause game' }));
    expect(onPause).toHaveBeenCalledOnce();
    unmount();
    render(<MenuSheet paused onPause={() => {}} onResume={() => {}} onSettings={() => {}} onRules={() => {}} onLeave={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Resume game' })).toBeInTheDocument();
  });

  it('has sound one tap away, and opens settings, rules and leave', async () => {
    const onSettings = vi.fn();
    const onLeave = vi.fn();
    render(<MenuSheet paused={false} onPause={() => {}} onResume={() => {}} onSettings={onSettings} onRules={() => {}} onLeave={onLeave} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(usePrefs.getState().sound).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Leave to home' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

describe('ProfileForm', () => {
  it('cannot submit a blank name and submits the cleaned name with the avatar', async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm initialName="" initialAvatar="🦊" submitLabel="Continue" onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your name'), '   ');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Your name'), 'Kuba  K ');
    await userEvent.click(screen.getByRole('button', { name: 'Avatar 🐻' }));
    expect(screen.getByRole('button', { name: 'Avatar 🐻' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledWith('Kuba K', '🐻');
  });
});
