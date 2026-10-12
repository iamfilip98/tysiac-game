import { useState } from 'react';
import './profile.css';
import { AVATARS, NAME_MAX_UNITS, cleanName } from '../store/prefs';
import { useT } from '../i18n/useT';

export interface ProfileFormProps {
  initialName: string;
  initialAvatar: string;
  submitLabel: string;
  onSubmit(name: string, avatar: string): void;
}

export function ProfileForm({ initialName, initialAvatar, submitLabel, onSubmit }: ProfileFormProps) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(initialAvatar || AVATARS[0]);
  const clean = cleanName(name);
  return (
    <form
      className="profile"
      onSubmit={e => {
        e.preventDefault();
        if (clean) onSubmit(clean, avatar);
      }}
    >
      <label className="field">
        <span className="lbl">{t('screens.profile.name')}</span>
        <input
          name="name"
          value={name}
          maxLength={NAME_MAX_UNITS}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="done"
          onChange={e => setName(e.target.value)}
        />
      </label>
      <fieldset className="avatars">
        <legend className="lbl">{t('screens.profile.avatar')}</legend>
        {AVATARS.map(a => (
          <button key={a} type="button" className="avatar avatar--pick" aria-label={t('screens.profile.avatarAria', { avatar: a })} aria-pressed={a === avatar} onClick={() => setAvatar(a)}>
            {a}
          </button>
        ))}
      </fieldset>
      <button type="submit" className="btn btn--pri" disabled={!clean}>
        {submitLabel}
      </button>
    </form>
  );
}
