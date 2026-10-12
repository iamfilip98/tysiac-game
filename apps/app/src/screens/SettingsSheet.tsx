import { Sheet } from '../ui/Sheet';
import { ProfileForm } from '../ui/ProfileForm';
import { usePrefs } from '../store/prefs';
import { THEMES } from '../theme/theme';
import { useT } from '../i18n/useT';
import './screens.css';

export interface SettingsSheetProps {
  /** Name/avatar editing (text input) — only outside the Game screen. */
  allowProfile: boolean;
  coachOn: boolean;
  onCoachChange?(on: boolean): void;
  onRules(): void;
  onClose(): void;
}

/** Language names are always written in their own language. */
const LANG_NAMES = [
  ['en', 'English'],
  ['pl', 'Polski'],
  ['da', 'Dansk'],
] as const;

export function SettingsSheet({ allowProfile, coachOn, onCoachChange, onRules, onClose }: SettingsSheetProps) {
  const p = usePrefs();
  const t = useT();
  return (
    <Sheet title={t('common.settings')} onClose={onClose}>
      <div className="settings">
        <div className="lbl">{t('common.language')}</div>
        <div className="seg" role="radiogroup" aria-label={t('common.language')}>
          {LANG_NAMES.map(([id, name]) => (
            <button key={id} type="button" role="radio" lang={id} aria-checked={p.lang === id} onClick={() => void p.setLang(id).catch(() => {})}>
              {name}
            </button>
          ))}
        </div>
        <div className="lbl">{t('common.theme')}</div>
        <div className="themes" role="radiogroup" aria-label={t('common.theme')}>
          {THEMES.map(th => (
            <button key={th.id} type="button" role="radio" aria-checked={p.theme === th.id} className="theme-pick" onClick={() => p.setTheme(th.id)}>
              <span className="theme-pick__sw" aria-hidden="true">
                {th.swatch.map(c => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              {th.name}
            </button>
          ))}
        </div>
        <button type="button" role="switch" aria-checked={p.sound} className="switch" onClick={() => p.setSound(!p.sound)}>
          {t('common.sound')}
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
          {t('common.coachHints')}
        </button>
        <div className="lbl">{t('common.speed')}</div>
        <div className="seg" role="radiogroup" aria-label={t('common.speed')}>
          {(['normal', 'fast'] as const).map(sp => (
            <button key={sp} type="button" role="radio" aria-checked={p.speed === sp} onClick={() => p.setSpeed(sp)}>
              {sp === 'normal' ? t('common.speed.normal') : t('common.speed.fast')}
            </button>
          ))}
        </div>
        {allowProfile && (
          <>
            <div className="lbl">{t('common.profile')}</div>
            <ProfileForm initialName={p.name} initialAvatar={p.avatar} submitLabel={t('common.save')} onSubmit={(n, a) => p.setProfile(n, a)} />
          </>
        )}
        <button type="button" className="btn btn--sec" onClick={onRules}>
          {t('common.rules')}
        </button>
      </div>
    </Sheet>
  );
}
