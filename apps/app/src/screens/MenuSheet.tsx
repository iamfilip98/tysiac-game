import { Sheet } from '../ui/Sheet';
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

export function MenuSheet({ paused, onPause, onResume, onSettings, onRules, onLeave, onClose }: MenuSheetProps) {
  const t = useT();
  return (
    <Sheet title={t('game.menu.title')} onClose={onClose}>
      <div className="menu">
        {paused ? (
          <button type="button" className="btn btn--sec" onClick={onResume}>
            {t('game.menu.resume')}
          </button>
        ) : (
          <button type="button" className="btn btn--sec" onClick={onPause}>
            {t('game.menu.pause')}
          </button>
        )}
        <button type="button" className="btn btn--sec" onClick={onSettings}>
          {t('common.settings')}
        </button>
        <button type="button" className="btn btn--sec" onClick={onRules}>
          {t('common.rules')}
        </button>
        <button type="button" className="btn btn--sec" onClick={onLeave}>
          {t('game.menu.leave')}
        </button>
      </div>
    </Sheet>
  );
}
