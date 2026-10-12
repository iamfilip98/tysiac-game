import { describe, expect, it } from 'vitest';
import { buildLesson, lessonProblems } from './lesson';

// Seed finder, skipped in normal runs. Usage:
//   GEN_LESSON=1 pnpm --filter @tysiac/app exec vitest run src/learn/findSeed.test.ts
describe.runIf(process.env.GEN_LESSON === '1')('lesson seed finder', () => {
  it('prints the first seed that teaches every beat', () => {
    const misses = new Map<string, number>();
    for (let n = 1; n <= 20_000; n++) {
      const seed = `lesson-${n}`;
      let problems: string[];
      try {
        problems = lessonProblems(buildLesson(seed));
      } catch (e) {
        problems = [`throws: ${String(e).slice(0, 80)}`];
      }
      if (problems.length === 0) {
        console.log(`LESSON_SEED = '${seed}'`);
        return;
      }
      for (const p of problems) misses.set(p, (misses.get(p) ?? 0) + 1);
    }
    console.log(Object.fromEntries(misses));
    expect.fail('no lesson seed in lesson-1..lesson-20000');
  }, 300_000);
});
