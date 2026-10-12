import { Sheet } from '../ui/Sheet';
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
  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className="menu">
        {paused ? (
          <button type="button" className="btn btn--sec" onClick={onResume}>
            Resume game
          </button>
        ) : (
          <button type="button" className="btn btn--sec" onClick={onPause}>
            Pause game
          </button>
        )}
        <button type="button" className="btn btn--sec" onClick={onSettings}>
          Settings
        </button>
        <button type="button" className="btn btn--sec" onClick={onRules}>
          Rules
        </button>
        <button type="button" className="btn btn--sec" onClick={onLeave}>
          Leave to home
        </button>
      </div>
    </Sheet>
  );
}
