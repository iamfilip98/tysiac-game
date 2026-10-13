import { Sheet } from '../ui/Sheet';
import { Group, Icon, NavRow, SwitchRow } from '../ui/controls';
import { usePrefs } from '../store/prefs';
import { useT } from '../i18n/useT';
import './screens.css';

export interface MenuSheetProps {
  paused: boolean;
  onPause(): void;
  onResume(): void;
  onSettings(): void;
  onRules(): void;
  onLeave(): void;
  onClose(): void;
}

/** The in-game menu: the same grouped rows as Settings, with sound one tap away. */
export function MenuSheet({ paused, onPause, onResume, onSettings, onRules, onLeave, onClose }: MenuSheetProps) {
  const t = useT();
  const sound = usePrefs(s => s.sound);
  const setSound = usePrefs(s => s.setSound);
  return (
    <Sheet title={t('game.menu.title')} onClose={onClose}>
      <div className="menu">
        <Group>
          {paused ? (
            <NavRow icon={<Icon name="play" />} label={t('game.menu.resume')} chevron={false} onClick={onResume} />
          ) : (
            <NavRow icon={<Icon name="pause" />} label={t('game.menu.pause')} chevron={false} onClick={onPause} />
          )}
          <SwitchRow icon={<Icon name="sound" />} label={t('common.sound')} checked={sound} onChange={setSound} />
        </Group>
        <Group>
          <NavRow icon={<Icon name="gear" />} label={t('common.settings')} onClick={onSettings} />
          <NavRow icon={<Icon name="book" />} label={t('common.rules')} onClick={onRules} />
        </Group>
        <Group>
          <NavRow icon={<Icon name="leave" />} label={t('game.menu.leave')} chevron={false} tone="danger" onClick={onLeave} />
        </Group>
      </div>
    </Sheet>
  );
}
