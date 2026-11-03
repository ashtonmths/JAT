// Runs a heavy test command (`pnpm test`, `pnpm e2e`) so it doesn't take over the computer:
// - one at a time: a run waits while another, from any worktree or checkout, holds the lock
//   (a quick `pnpm test` waits behind a long `pnpm e2e` too);
// - at the lowest CPU priority, which the app servers and Chrome it starts inherit. On Linux it
//   also asks for idle disk priority, which only the BFQ disk scheduler honours.
// Worker counts are set in the configs (testWorkers.ts). TEST_LOCK=off skips the wait.
// If this wrapper is killed outright (kill -9), what it started keeps running while the next run
// sees the lock as left behind and starts anyway.
//
//   node scripts/test-run.mjs <command> [args...]
import { spawn, spawnSync } from "node:child_process";
import { linkSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { setPriority, tmpdir } from "node:os";
import { join } from "node:path";

const LOCK = join(tmpdir(), "jat-test-run.lock");
const NESTED = "JAT_TEST_RUN_HELD"; // set for what we start, so a nested run doesn't wait on us
const POLL_MS = 2000;
const UNREADABLE_AFTER_MS = 10_000; // a lock nobody can read for this long is treated as left behind
const WINDOWS = process.platform === "win32";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/test-run.mjs <command> [args...]");
  process.exit(2);
}

/** What the lock says, or null if it's gone or unreadable. */
function holder(path = LOCK) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return Number.isInteger(value?.pid) ? value : null;
  } catch {
    return null;
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

/** Creates the lock whole or not at all: written aside, then linked into place. */
function create() {
  const mine = `${LOCK}.${process.pid}`;
  writeFileSync(mine, JSON.stringify({ pid: process.pid, cwd: process.cwd(), command: [command, ...args] }));
  try {
    linkSync(mine, LOCK);
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  } finally {
    rmSync(mine, { force: true });
  }
}

/** Whether the lock was left by a run that's gone: its process ended, or it's long unreadable. */
function leftBehind() {
  const current = holder();
  if (current) return alive(current.pid) ? null : { pid: current.pid };
  try {
    const age = Date.now() - statSync(LOCK).mtimeMs;
    return age > UNREADABLE_AFTER_MS ? { pid: null } : null;
  } catch {
    return null; // gone: the next try creates it
  }
}

/** True once we hold the lock; false while another run holds it. */
function tryLock() {
  if (create()) return true;
  const stale = leftBehind();
  if (!stale) return false;
  // Move it aside, then make sure it was the one we judged: another waiter may have replaced it.
  const aside = `${LOCK}.${process.pid}.stale`;
  try {
    renameSync(LOCK, aside);
  } catch {
    return false; // someone else moved it, or we may not: look again on the next poll
  }
  const moved = holder(aside);
  if ((moved?.pid ?? null) !== stale.pid) {
    try {
      linkSync(aside, LOCK); // a live run's lock: put it back
    } catch {
      // a third run already took it
    }
    rmSync(aside, { force: true });
    return false;
  }
  rmSync(aside, { force: true });
  return create();
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
        `Waiting for another test run to finish (pid ${current?.pid ?? "?"} in ${current?.cwd ?? "?"}).\n` +
          `TEST_LOCK=off skips the wait; if no run is going, delete ${LOCK}.`,
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

// On Windows pnpm, vitest and playwright are .cmd files, so they need a shell and one quoted line.
const quote = (arg) => (/^[\w./:=@-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`);
const child = WINDOWS
  ? spawn([command, ...args].map(quote).join(" "), {
      stdio: "inherit",
      env: { ...process.env, [NESTED]: "1" },
      shell: true,
    })
  : spawn(command, args, { stdio: "inherit", env: { ...process.env, [NESTED]: "1" } });

// Ctrl+C reaches the whole process group from the terminal already: wait for the run to stop
// (Playwright takes a second Ctrl+C as "quit now", skipping its clean-up). Pass on the others.
process.on("SIGINT", () => {});
if (!WINDOWS) {
  for (const signal of ["SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
}
const SIGNAL_CODES = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
child.on("error", (error) => {
  if (locking) unlock();
  console.error(`Couldn't start ${command}: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (locking) unlock();
  process.exit(code ?? 128 + (SIGNAL_CODES[signal] ?? 0));
});
