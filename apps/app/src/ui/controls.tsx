import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import './controls.css';

/**
 * Roving focus for a radiogroup (WAI-ARIA radio pattern): only the checked option is in the tab order,
 * arrow keys move and select (with wrap), Home and End jump to the ends.
 */
export function useRadioKeys(count: number, index: number, select: (i: number) => void) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent) => {
    const from = Math.max(index, 0);
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (from + 1) % count
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (from - 1 + count) % count
      : e.key === 'Home' ? 0
      : e.key === 'End' ? count - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    select(to);
    refs.current[to]?.focus();
  };
  const item = (i: number) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    tabIndex: i === Math.max(index, 0) ? 0 : -1,
  });
  return { onKeyDown, item };
}

export interface SegmentedProps<T extends string> {
  /** Accessible name: the id of a visible label, or a label string. */
  labelledBy?: string;
  label?: string;
  value: T;
  options: readonly { value: T; label: string; lang?: string }[];
  onChange(value: T): void;
  className?: string;
}

/** iOS-style segmented control: a sliding thumb in a recessed track. */
export function Segmented<T extends string>({ labelledBy, label, value, options, onChange, className }: SegmentedProps<T>) {
  const index = options.findIndex(o => o.value === value);
  const keys = useRadioKeys(options.length, index, i => onChange(options[i]!.value));
  return (
    <div
      className={`segmented ${className ?? ''}`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      style={{ '--n': options.length, '--i': Math.max(index, 0) } as CSSProperties}
      onKeyDown={keys.onKeyDown}
    >
      <span className="segmented__thumb" aria-hidden="true" data-on={index >= 0 || undefined} />
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" lang={o.lang} aria-checked={o.value === value} className="segmented__opt" onClick={() => onChange(o.value)} {...keys.item(i)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface SwitchRowProps {
  label: string;
  hint?: string;
  icon?: ReactNode;
  checked: boolean;
  onChange(on: boolean): void;
}

/** A full-width settings row that is one big switch: label (and hint) on the left, an iOS toggle on the right. */
export function SwitchRow({ label, hint, icon, checked, onChange }: SwitchRowProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}l`}
      aria-describedby={hint ? `${id}h` : undefined}
      className="srow"
      onClick={() => onChange(!checked)}
    >
      {icon && <RowIcon>{icon}</RowIcon>}
      <span className="srow__text">
        <span id={`${id}l`} className="srow__label">
          {label}
        </span>
        {hint && (
          <span id={`${id}h`} className="srow__hint">
            {hint}
          </span>
        )}
      </span>
      <span className="toggle" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </button>
  );
}

/** A row that opens something (another sheet) or acts at once. */
export function NavRow({ label, icon, onClick, chevron = true, tone }: { label: string; icon?: ReactNode; onClick(): void; chevron?: boolean; tone?: 'danger' }) {
  return (
    <button type="button" className={`srow ${tone === 'danger' ? 'srow--danger' : ''}`} onClick={onClick}>
      {icon && <RowIcon>{icon}</RowIcon>}
      <span className="srow__text">
        <span className="srow__label">{label}</span>
      </span>
      {chevron && <Icon name="chevron" className="srow__chev" />}
    </button>
  );
}

function RowIcon({ children }: { children: ReactNode }) {
  return (
    <span className="srow__icon" aria-hidden="true">
      {children}
    </span>
  );
}

/** A titled group of rows (iOS inset grouped list). A group, not a landmark: a sheet holds several. */
export function Group({ title, children, boxed = true }: { title?: string; children: ReactNode; boxed?: boolean }) {
  const id = useId();
  return (
    <div className="sgroup" role={title ? 'group' : undefined} aria-labelledby={title ? id : undefined}>
      {title && (
        <h3 id={id} className="sgroup__title">
          {title}
        </h3>
      )}
      {boxed ? <div className="sgroup__box">{children}</div> : children}
    </div>
  );
}

const PATHS = {
  chevron: 'M9 5l7 7-7 7',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11',
  coach: 'M12 20V8M6.5 13.5L12 8l5.5 5.5M7 4h10',
  speed: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  play: 'M8 5.5v13l10.5-6.5z',
  gear: 'M12 8.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zM12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7',
  book: 'M4.5 5.5c2.6-1 5.2-.8 7.5.8v13c-2.3-1.6-4.9-1.8-7.5-.8zM19.5 5.5c-2.6-1-5.2-.8-7.5.8v13c2.3-1.6 4.9-1.8 7.5-.8z',
  leave: 'M10 4.5H5.5v15H10M14 8l4 4-4 4M18 12H9',
} as const;

export function Icon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
