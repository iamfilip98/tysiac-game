import { useId, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { ProfileForm } from '../ui/ProfileForm';
import { Group, Icon, NavRow, Segmented, SwitchRow, useRadioKeys } from '../ui/controls';
import { CardFace } from '../game/Card';
import { usePrefs } from '../store/prefs';
import { THEMES, type ThemeId } from '../theme/theme';
import { useT } from '../i18n/useT';
import type { Lang } from '../i18n';
import './screens.css';
import './settings.css';

export interface SettingsSheetProps {
  /** Name/avatar editing (text input), only outside the Game screen. */
  allowProfile: boolean;
  coachOn: boolean;
  onCoachChange?(on: boolean): void;
  onRules(): void;
  onClose(): void;
}

/** Language names are always written in their own language. */
const LANG_OPTIONS: readonly { value: Lang; label: string; lang: string }[] = [
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'pl', label: 'Polski', lang: 'pl' },
  { value: 'da', label: 'Dansk', lang: 'da' },
];

/**
 * Repaints with a short cross-fade where the browser supports view transitions (and motion is welcome). Not for
 * a change made from the keyboard: arrowing through the themes would fade on every step and freeze the page
 * (and the focus ring) for each transition.
 */
function crossFade(change: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !still) doc.startViewTransition(change);
  else change();
}

export function SettingsSheet({ allowProfile, coachOn, onCoachChange, onRules, onClose }: SettingsSheetProps) {
  const p = usePrefs();
  const t = useT();
  const speedId = useId();
  const [langError, setLangError] = useState(false);
  return (
    <Sheet title={t('common.settings')} onClose={onClose}>
      <div className="settings">
        <Group title={t('settings.group.game')}>
          <SwitchRow icon={<Icon name="sound" />} label={t('common.sound')} checked={p.sound} onChange={on => p.setSound(on)} />
          <SwitchRow
            icon={<Icon name="coach" />}
            label={t('common.coachHints')}
            hint={t('settings.coachHint')}
            checked={coachOn}
            onChange={on => {
              p.setCoach(on);
              onCoachChange?.(on);
            }}
          />
          <div className="srow srow--stack">
            <span className="srow__head">
              <span className="srow__icon" aria-hidden="true">
                <Icon name="speed" />
              </span>
              <span className="srow__text">
                <span id={speedId} className="srow__label">
                  {t('common.speed')}
                </span>
                <span className="srow__hint">{t('settings.speedHint')}</span>
              </span>
            </span>
            <Segmented
              labelledBy={speedId}
              value={p.speed}
              options={[
                { value: 'normal', label: t('common.speed.normal') },
                { value: 'fast', label: t('common.speed.fast') },
              ]}
              onChange={sp => p.setSpeed(sp)}
            />
          </div>
        </Group>

        <Group title={t('common.theme')} boxed={false}>
          <ThemePicker value={p.theme} label={t('common.theme')} onChange={(id, keyboard) => (keyboard ? p.setTheme(id) : crossFade(() => p.setTheme(id)))} />
        </Group>

        <Group title={t('common.language')} boxed={false}>
          <Segmented
            label={t('common.language')}
            value={p.lang}
            options={LANG_OPTIONS}
            onChange={id => void p.setLang(id).then(() => setLangError(false), () => setLangError(true))}
          />
          {langError && (
            <p role="alert" className="settings__error">
              {t('errors.langLoadFailed')}
            </p>
          )}
        </Group>

        {allowProfile && (
          <Group title={t('common.profile')}>
            <div className="settings__profile">
              <ProfileForm initialName={p.name} initialAvatar={p.avatar} submitLabel={t('common.save')} onSubmit={(n, a) => p.setProfile(n, a)} />
            </div>
          </Group>
        )}

        <Group>
          <NavRow icon={<Icon name="book" />} label={t('common.rules')} onClick={onRules} />
        </Group>
      </div>
    </Sheet>
  );
}

const ACE = { suit: 'hearts', rank: 'A' } as const;
const KING = { suit: 'spades', rank: 'K' } as const;

/**
 * Each option is a tiny table drawn in that theme's own tokens (the scene carries `data-theme`), so the
 * preview is the real felt, card face, card back and accent rather than a hand-kept swatch. `keyboard` tells
 * the arrow keys and Enter/Space (a click with detail 0) from a tap.
 */
function ThemePicker({ value, label, onChange }: { value: ThemeId; label: string; onChange(id: ThemeId, keyboard: boolean): void }) {
  const t = useT();
  const index = THEMES.findIndex(th => th.id === value);
  const keys = useRadioKeys(THEMES.length, index, i => onChange(THEMES[i]!.id, true));
  return (
    <div className="tpick" role="radiogroup" aria-label={label} onKeyDown={keys.onKeyDown}>
      {THEMES.map((th, i) => (
        <button key={th.id} type="button" role="radio" aria-checked={th.id === value} className="tpick__opt" onClick={e => onChange(th.id, e.detail === 0)} {...keys.item(i)}>
          <span className="tpick__frame" aria-hidden="true">
            <span className="tpick__scene" data-theme={th.id}>
              <span className="back tpick__back" />
              <span className="card card--red tpick__card tpick__card--a">
                <CardFace card={ACE} />
              </span>
              <span className="card tpick__card tpick__card--b">
                <CardFace card={KING} />
              </span>
              <span className="tpick__accent" />
            </span>
            <span className="tpick__check">
              <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
          <span className="tpick__name" data-theme={th.id}>
            {t(`theme.${th.id}`)}
          </span>
        </button>
      ))}
    </div>
  );
}
