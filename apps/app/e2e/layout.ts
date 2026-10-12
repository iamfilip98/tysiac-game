import { expect, type Page } from '@playwright/test';

export interface FitOptions {
  /** Home and Lobby scroll normally: only check sideways overflow. */
  allowScroll?: boolean;
}

/** Elements outside the viewport, and document scrolling, as human-readable problems. */
export async function layoutProblems(page: Page, opts: FitOptions = {}): Promise<string[]> {
  return page.evaluate(({ allowScroll }) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) out.push(`page scrolls sideways (${doc.scrollWidth} > ${vw})`);
    if (!allowScroll) {
      if (doc.scrollHeight > vh + 1) out.push(`page scrolls (${doc.scrollHeight} > ${vh})`);
      if (window.scrollY !== 0) out.push(`scrollY is ${window.scrollY}`);
    }
    const zone = document.querySelector<HTMLElement>('.zone');
    if (zone && zone.scrollHeight > zone.clientHeight + 1) {
      out.push(`zone overflows (${zone.scrollHeight} > ${zone.clientHeight})`);
    }
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (el.parentElement?.closest('[data-scroll-clip]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const sideways = r.left < -1 || r.right > vw + 1;
      const vertical = !allowScroll && (r.top < -1 || r.bottom > vh + 1);
      if (sideways || vertical) {
        out.push(`<${el.tagName.toLowerCase()} class="${String(el.className)}"> at ${Math.round(r.left)},${Math.round(r.top)} size ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out.slice(0, 8);
  }, { allowScroll: !!opts.allowScroll });
}

export async function expectFits(page: Page, label: string, opts: FitOptions = {}): Promise<void> {
  await expect.poll(() => layoutProblems(page, opts), { message: `layout problems at "${label}"`, timeout: 5000 }).toEqual([]);
}

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Injects `--sa-*` overrides on :root, simulating iPhone notch / home-indicator insets. */
export async function setSafeInsets(page: Page, insets: Partial<SafeInsets>): Promise<void> {
  const decl = (Object.entries(insets) as [string, number][]).map(([k, v]) => `--sa-${k}: ${v}px !important;`).join(' ');
  await page.evaluate(css => {
    let style = document.getElementById('e2e-safe-insets');
    if (!style) {
      style = document.createElement('style');
      style.id = 'e2e-safe-insets';
      document.head.appendChild(style);
    }
    style.textContent = `:root { ${css} }`;
  }, decl);
}

/**
 * Interactive things (hand cards, buttons, inputs) that stick out of the safe rect or into the rounded
 * screen corners. `scope` limits the search to a selector (e.g. an open sheet); default is the whole page.
 */
export async function safeAreaProblems(page: Page, insets: SafeInsets, radius = 55, scope = 'body', scrollable = false): Promise<string[]> {
  return page.evaluate(({ insets, radius, scope, scrollable }) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const safe = { l: insets.left, t: insets.top, r: vw - insets.right, b: vh - insets.bottom };
    const root = document.querySelector(scope);
    if (!root) return [`scope ${scope} not found`];
    // A point is in the corner mask when inside the corner square and farther than radius from the circle centre.
    const inMask = (x: number, y: number): boolean => {
      const cx = x < vw / 2 ? radius : vw - radius;
      const cy = y < vh / 2 ? radius : vh - radius;
      const inSquare = (x < radius || x > vw - radius) && (y < radius || y > vh - radius);
      return inSquare && Math.hypot(x - cx, y - cy) > radius;
    };
    const out: string[] = [];
    const items = Array.from(root.querySelectorAll<HTMLElement>('button, input, select, [role="button"], [role="radio"]')).filter(el => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.closest('[data-scroll-clip]');
    });
    const tagOf = (el: HTMLElement, r: DOMRect) =>
      `"${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 24) || el.tagName}" at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`;
    const cornerHit = (r: DOMRect) =>
      ([[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]] as [number, number][]).some(
        ([x, y]) => y >= 0 && y <= vh && inMask(x, y),
      );
    // Scrollable screens (Home, Lobby): the top inset applies at scroll start, the bottom inset at scroll end.
    const scrollers = scrollable
      ? [
          document.documentElement, // the viewport scrolls even though its overflow is `visible`
          ...Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY)),
        ].filter(e => e.scrollHeight > e.clientHeight + 1)
      : [];
    const bad = new Set<string>();
    const pass = (end: boolean) => {
      for (const e of scrollers) e.scrollTop = end ? e.scrollHeight : 0;
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (!scrollable && (r.bottom <= 0 || r.top >= vh)) continue; // scrolled out of its own clip
        const sideways = r.left < safe.l - 0.5 || r.right > safe.r + 0.5;
        const edge = scrollable ? (end ? r.bottom > safe.b + 0.5 : r.top < safe.t - 0.5) : r.top < safe.t - 0.5 || r.bottom > safe.b + 0.5;
        if (sideways || edge) bad.add(`outside safe rect: ${tagOf(el, r)}`);
        else if (cornerHit(r)) bad.add(`inside rounded-corner mask: ${tagOf(el, r)}`);
      }
    };
    if (scrollable) {
      const saved = scrollers.map(e => e.scrollTop);
      pass(false);
      pass(true);
      scrollers.forEach((e, i) => { e.scrollTop = saved[i]!; });
    } else {
      pass(false);
    }
    out.push(...bad);
    return out.slice(0, 8);
  }, { insets, radius, scope, scrollable });
}

export async function expectSafe(page: Page, label: string, insets: SafeInsets, scope = 'body', scrollable = false): Promise<void> {
  await expect.poll(() => safeAreaProblems(page, insets, 55, scope, scrollable), { message: `safe-area problems at "${label}"`, timeout: 5000 }).toEqual([]);
}
