/** Playwright's bundled pngjs, used to read screenshot pixels in Node (see cards.spec). */
declare module 'playwright-core/lib/utilsBundle' {
  export const PNG: { sync: { read(buf: Buffer): { width: number; height: number; data: Buffer } } };
}
