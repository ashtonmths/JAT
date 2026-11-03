// Runs a heavy test command (`pnpm test`, `pnpm e2e`) so it doesn't take over the computer:
// - one at a time: a run waits while another, from any worktree or checkout, holds the lock;
// - at the lowest CPU priority, and on Linux the lowest disk priority, which the app servers
//   and Chrome it starts inherit.
// Worker counts are set in the configs (testWorkers.ts). TEST_LOCK=off skips the wait.
//
//   node scripts/test-run.mjs <command> [args...]
import { spawn, spawnSync } from "node:child_process";
import { openSync, readFileSync, renameSync, rmSync, writeSync, closeSync } from "node:fs";
import { setPriority, tmpdir } from "node:os";
import { join } from "node:path";

const LOCK = join(tmpdir(), "jat-test-run.lock");
const NESTED = "JAT_TEST_RUN_HELD"; // set for what we start, so a nested run doesn't wait on us
const POLL_MS = 2000;

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/test-run.mjs <command> [args...]");
  process.exit(2);
}

function holder() {
  try {
    return JSON.parse(readFileSync(LOCK, "utf8"));
  } catch {
    return null; // gone, or half written
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM"; // someone else's process, but running
  }
}

/** True once we hold the lock; false while a live run holds it. */
function tryLock() {
  try {
    const fd = openSync(LOCK, "wx");
    writeSync(fd, JSON.stringify({ pid: process.pid, cwd: process.cwd(), command: [command, ...args] }));
    closeSync(fd);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const current = holder();
  if (current && Number.isInteger(current.pid) && alive(current.pid)) return false;
  if (!current) return false; // being written right now: look again shortly
  // Left behind by a run that died: move it aside (only one waiter can), then take it.
  try {
    renameSync(LOCK, `${LOCK}.${process.pid}.stale`);
    rmSync(`${LOCK}.${process.pid}.stale`, { force: true });
  } catch {
    // another waiter got there first
  }
  return tryLock();
}

function unlock() {
  if (holder()?.pid === process.pid) rmSync(LOCK, { force: true });
}

async function waitForLock() {
  let said = false;
  while (!tryLock()) {
    if (!said) {
      const current = holder();
      console.error(
        `Waiting for another test run to finish (pid ${current?.pid ?? "?"} in ${current?.cwd ?? "?"}).` +
          " TEST_LOCK=off skips the wait.",
      );
      said = true;
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
}

const locking = !process.env[NESTED] && process.env.TEST_LOCK !== "off";
if (locking) await waitForLock();

// Lowest priority for us, and so for everything we start.
try {
  setPriority(19);
} catch {
  // not allowed here: run at normal priority
}
if (process.platform === "linux") {
  spawnSync("ionice", ["-c", "3", "-p", String(process.pid)], { stdio: "ignore" });
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, [NESTED]: "1" },
  shell: process.platform === "win32", // pnpm, vitest and playwright are .cmd files there
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  if (locking) unlock();
  console.error(`Couldn't start ${command}: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (locking) unlock();
  process.exit(code ?? (signal ? 1 : 0));
});
