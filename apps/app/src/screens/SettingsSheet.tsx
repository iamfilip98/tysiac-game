import { Sheet } from '../ui/Sheet';
import { ProfileForm } from '../ui/ProfileForm';
import { usePrefs } from '../store/prefs';
import { THEMES } from '../theme/theme';
import './screens.css';

export interface SettingsSheetProps {
  /** Name/avatar editing (text input) — only outside the Game screen. */
  allowProfile: boolean;
  coachOn: boolean;
  onCoachChange?(on: boolean): void;
  onRules(): void;
  onClose(): void;
}

export function SettingsSheet({ allowProfile, coachOn, onCoachChange, onRules, onClose }: SettingsSheetProps) {
  const p = usePrefs();
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="settings">
        <div className="lbl">Theme</div>
        <div className="themes" role="radiogroup" aria-label="Theme">
          {THEMES.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={p.theme === t.id} className="theme-pick" onClick={() => p.setTheme(t.id)}>
              <span className="theme-pick__sw" aria-hidden="true">
                {t.swatch.map(c => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <button type="button" role="switch" aria-checked={p.sound} className="switch" onClick={() => p.setSound(!p.sound)}>
          Sound
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={coachOn}
          className="switch"
          onClick={() => {
            p.setCoach(!coachOn);
            onCoachChange?.(!coachOn);
          }}
        >
          Coach hints
        </button>
        <div className="lbl">Animation speed</div>
        <div className="seg" role="radiogroup" aria-label="Animation speed">
          {(['normal', 'fast'] as const).map(sp => (
            <button key={sp} type="button" role="radio" aria-checked={p.speed === sp} onClick={() => p.setSpeed(sp)}>
              {sp === 'normal' ? 'Normal' : 'Fast'}
            </button>
          ))}
        </div>
        {allowProfile && (
          <>
            <div className="lbl">Profile</div>
            <ProfileForm initialName={p.name} initialAvatar={p.avatar} submitLabel="Save" onSubmit={(n, a) => p.setProfile(n, a)} />
          </>
        )}
        <button type="button" className="btn btn--sec" onClick={onRules}>
          Rules
        </button>
      </div>
    </Sheet>
  );
}
