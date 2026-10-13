export type ThemeId = 'brass' | 'wycinanki' | 'midnight' | 'boleslawiec' | 'zakopane' | 'noir';

/** The picker order (brass is the default). Names are localized (`theme.<id>`); the preview reads the theme's own tokens. */
export const THEMES: { id: ThemeId; themeColor: string }[] = [
  { id: 'brass', themeColor: '#0d3528' },
  { id: 'wycinanki', themeColor: '#f3ead8' },
  { id: 'boleslawiec', themeColor: '#f6f1e4' },
  { id: 'zakopane', themeColor: '#2e1e13' },
  { id: 'noir', themeColor: '#000000' },
  { id: 'midnight', themeColor: '#0e1016' },
];

/** Every custom property a theme block in themes.css must define. */
export const THEME_TOKENS = [
  '--bg', '--bg-solid', '--ink', '--ink-dim', '--accent', '--accent-ink', '--accent-soft', '--coach',
  '--panel', '--panel-border', '--panel-shadow', '--btn-sec-bg', '--btn-sec-border', '--icon-bg', '--icon-border',
  '--avatar-bg', '--avatar-ink', '--avatar-ring', '--turn-ring', '--card-bg', '--card-ink', '--card-red',
  '--card-border', '--card-shadow', '--back-bg', '--back-border', '--slot-border', '--slot-bg', '--chip-muted-bg',
  '--font-display', '--font-card', '--sheet-bg', '--table-felt', '--table-rim', '--danger', '--status-scrim',
] as const;

export function isThemeId(x: unknown): x is ThemeId {
  return THEMES.some(t => t.id === x);
}

export function applyTheme(id: ThemeId, doc: Document = document): void {
  doc.documentElement.dataset.theme = id;
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.append(meta);
  }
  meta.content = THEMES.find(t => t.id === id)!.themeColor;
}
