import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'motion/react';
import './sheet.css';

export interface SheetProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Open sheets, oldest first. Only the last (topmost) one reacts to Escape. */
const openSheets: symbol[] = [];

export function Sheet({ title, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  // Move focus into the dialog, and hand it back to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => trigger?.focus();
  }, []);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = Symbol('sheet');
    openSheets.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === id) closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets.splice(openSheets.indexOf(id), 1);
    };
  }, []);

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={e => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <m.section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
      >
        <header className="sheet__head">
          <h2 className="display">{title}</h2>
          {onClose && (
            <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          )}
        </header>
        <div className="sheet__body" data-scroll-clip>
          {children}
        </div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </m.section>
    </div>,
    document.body,
  );
}
