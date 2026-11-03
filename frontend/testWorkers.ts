import { availableParallelism } from "node:os";

/**
 * How many workers Vitest and Playwright may use: a quarter of the cores (3 on a 12-core machine,
 * at least 1), so a test run leaves the rest of the computer usable. Each Playwright worker also
 * starts its own app server and Chrome, so the default stays low. Set TEST_WORKERS to change it.
 */
export function testWorkers(
  env: Record<string, string | undefined> = process.env,
  cores: number = availableParallelism(),
): number {
  const asked = Number.parseInt(env.TEST_WORKERS ?? "", 10);
  if (Number.isFinite(asked) && asked > 0) return asked;
  return Math.max(1, Math.floor(cores / 4));
}
