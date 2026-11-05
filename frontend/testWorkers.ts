import { availableParallelism } from "node:os";

/**
 * How many workers Vitest and Playwright may use: half the CPU threads (6 where there are 12, at
 * least 1). Each Playwright worker also starts its own app server and Chrome; test runs go at low
 * priority, so the rest of the computer stays usable (Kai, 2026-11-05: half, up from a quarter).
 * Set TEST_WORKERS to change it.
 */
export function testWorkers(
  env: Record<string, string | undefined> = process.env,
  cores: number = availableParallelism(),
): number {
  const asked = Number.parseInt(env.TEST_WORKERS ?? "", 10);
  if (Number.isFinite(asked) && asked > 0) return asked;
  return Math.max(1, Math.floor(cores / 2));
}
