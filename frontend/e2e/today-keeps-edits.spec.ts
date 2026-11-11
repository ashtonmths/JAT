import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// What's being typed stays when the page's data moves under it: the date changing at midnight, and a
// round or call moving from Coming up to How did it go? once its time passes. Each test makes its own data.

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const patch = async (request: APIRequestContext, path: string, data: object) => {
  const done = await request.patch(`${API}/${path}`, { data });
  expect(done.ok(), `PATCH ${path}`).toBe(true);
};
const inMinutes = (minutes: number) =>
  new Date(Math.floor((Date.now() + minutes * 60_000) / 60_000) * 60_000).toISOString();
const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

// A fixed winter evening: London is on GMT, months from a clock change, whatever day the tests run.
const EVENING = new Date("2027-01-20T23:58:00Z");
const NEW_DAY = "2027-01-21";

/**
 * Holds the page's first request to `path` for the new day, so a test can look at the page while it
 * loads; release() lets it through and waits for the reply.
 */
const holdNewDay = async (page: Page, path: string, query: Record<string, string> = {}) => {
  let release: () => void = () => {};
  // Only that request: a person's page also lists open to-dos for its calls card.
  const wanted = (url: URL) =>
    url.pathname === `${API}/${path}` &&
    url.searchParams.get("today") === NEW_DAY &&
    Object.entries(query).every(([k, v]) => url.searchParams.get(k) === v);
  const arrived = new Promise<void>((resolve) => {
    void page.route(
      wanted,
      async (route) => {
        resolve();
        await new Promise<void>((go) => (release = go));
        await route.continue();
      },
      { times: 1 },
    );
  });
  return {
    arrived,
    release: async () => {
      const loaded = page.waitForResponse((r) => wanted(new URL(r.url())) && r.ok());
      release();
      await loaded;
    },
  };
};

/**
 * Runs the page's clock past midnight. useToday looks once a minute from when the page mounted, a
 * few seconds after 23:58: three minutes on, it has looked at least once after midnight.
 */
const crossMidnight = (page: Page) => page.clock.fastForward("03:00");

test.describe("at midnight", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: EVENING });
  });

  test("Today keeps a half-typed to-do and the page, dimmed while the new day loads", async ({ page }) => {
    const held = await holdNewDay(page, "next-actions");
    await page.goto("/");
    const todos = section(page, "To-dos");
    await todos.getByLabel("New to-do").fill("Typed before midnight");
    await crossMidnight(page);
    await held.arrived;
    const busy = page.locator('[aria-busy="true"]').filter({ has: section(page, "To-dos") });
    await expect(busy).toBeVisible();
    await expect(todos.getByLabel("New to-do")).toHaveValue("Typed before midnight");
    await held.release();
    await expect(busy).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
    await expect(todos.getByLabel("New to-do")).toHaveValue("Typed before midnight");
  });

  test("a To-dos card keeps a to-do being edited", async ({ page, request }) => {
    const person = await post<{ id: string }>(request, "contacts", { name: "Midnight Edit Person" });
    await post(request, "todos", {
      text: "Send the late note",
      entity_type: "contact",
      entity_id: person.id,
    });
    const held = await holdNewDay(page, "todos", { entity_id: person.id, status: "all" });
    await page.goto(`/people/${person.id}`);
    await page.getByRole("button", { name: "Edit to-do: Send the late note" }).click();
    const editor = page.getByLabel("What needs doing");
    await editor.fill("Send the late note, edited");
    await crossMidnight(page);
    await held.arrived;
    const busy = page.locator('[aria-busy="true"]').filter({ has: editor });
    await expect(busy).toBeVisible();
    await expect(editor).toHaveValue("Send the late note, edited");
    await held.release();
    await expect(busy).toHaveCount(0);
    await expect(editor).toHaveValue("Send the late note, edited");
  });
});

test.describe("when a round's or call's time passes", () => {
  /** Fills in the open dialog's who and why. */
  const fillIn = async (page: Page, dialog: Locator, why: string) => {
    await dialog
      .getByLabel(/^Who needed the change\?/)
      .first()
      .click();
    await page.getByRole("option", { name: "Them", exact: true }).click();
    await dialog.getByLabel("Why? (optional)").fill(why);
  };
  /** A refresh as on coming back to the window, once the data is old enough to refetch. */
  const refocus = async (page: Page) => {
    await page.clock.fastForward("00:15");
    const loaded = page.waitForResponse((r) => r.url().includes(`${API}/next-actions`) && r.ok());
    // TanStack Query listens on the window, where a real visibilitychange reaches it by bubbling.
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await loaded;
  };

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date() });
  });

  test("a round's Reschedule dialog stays open with what was typed", async ({ page, request }) => {
    const app = await post<{ id: string }>(request, "applications/quick", {
      company_name: "Last Minute Co",
      role_title: "Tested Role",
      route: "direct",
      tags: [],
    });
    const round = await post<{ id: string }>(request, `applications/${app.id}/interviews`, {
      title: "Starts soon",
      starts_at: inMinutes(30),
    });
    const label = "Round 1 · Starts soon";
    await page.goto("/");
    await page
      .locator("#coming-up")
      .getByRole("button", { name: `Reschedule ${label}` })
      .click();
    const dialog = page.locator(".mantine-Modal-content");
    await dialog.getByText(`Reschedule ${label}`).click(); // also waits for it to stop moving
    await fillIn(page, dialog, "They asked for later");

    // Its time passes (the server moves it by its own clock), and the page refreshes.
    await patch(request, `interviews/${round.id}`, { starts_at: inMinutes(-1) });
    await refocus(page);
    await expect(section(page, "How did it go?").getByText(label)).toBeVisible();
    await expect(dialog.getByLabel("Why? (optional)")).toHaveValue("They asked for later");
  });

  test("a call's Reschedule dialog stays open with what was typed", async ({ page, request }) => {
    const person = await post<{ id: string }>(request, "contacts", { name: "Last Minute Caller" });
    const call = await post<{ id: string }>(request, "meetings", {
      contact_id: person.id,
      title: "Quick chat",
      starts_at: inMinutes(30),
      ends_at: inMinutes(60),
    });
    const label = "Call with Last Minute Caller: Quick chat";
    await page.goto("/");
    await page
      .locator("#coming-up")
      .getByRole("button", { name: `Reschedule ${label}` })
      .click();
    const dialog = page.locator(".mantine-Modal-content");
    await dialog.getByText(`Reschedule ${label}`).click();
    await fillIn(page, dialog, "Running late");

    await patch(request, `meetings/${call.id}`, { starts_at: inMinutes(-1), ends_at: inMinutes(29) });
    await refocus(page);
    await expect(
      section(page, "How did it go?").getByRole("button", { name: `Reschedule ${label}` }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Why? (optional)")).toHaveValue("Running late");
  });
});
