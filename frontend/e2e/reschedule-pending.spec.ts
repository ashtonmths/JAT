import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// A round that can't go ahead at its time, with no new time agreed yet: marked from the Reschedule
// dialog, shown with its to-do on Today, then given its new time. Each test makes its own application.

interface Round {
  id: string;
  starts_at: string | null;
  rescheduled_count: number;
  needs_new_time_since: string | null;
  rebook_todo_id: string | null;
  moves: { from_at: string; to_at: string; by: string | null; reason: string | null }[];
}
interface Todo {
  id: string;
  text: string;
  due_on: string | null;
  done_at: string | null;
}

const API = "/api/v1";
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 1000) * 1000).toISOString();
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const bookedRound = async (request: APIRequestContext, company: string, title: string) => {
  const app = await post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: "Tested Role",
    route: "direct",
    tags: [],
  });
  const round = await post<Round>(request, `applications/${app.id}/interviews`, {
    title,
    starts_at: inDays(3),
  });
  return { appId: app.id, round, label: `Round 1 · ${title}` };
};
const roundNow = async (request: APIRequestContext, id: string) =>
  (await (await request.get(`${API}/interviews/${id}`)).json()) as Round;
const todosOf = async (request: APIRequestContext, appId: string) =>
  (await (
    await request.get(`${API}/todos`, {
      params: { entity_type: "application", entity_id: appId, status: "all" },
    })
  ).json()) as Todo[];

/** Today's date where the page runs (Europe/London, playwright.config.ts), as YYYY-MM-DD. */
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const londonParts = (iso: string | null | undefined) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso ?? ""));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: part("weekday"),
    day: String(Number(part("day"))), // "5", not "05"
    month: MONTHS[Number(part("month")) - 1],
    year: part("year"),
    hour: part("hour"),
    minute: part("minute"),
  };
};
/** "Tue 3 Nov, 10:00", as a move's timeline line writes a time. */
const dayTime = (iso: string | null | undefined) => {
  const p = londonParts(iso);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
};
/** "3 Nov 2026, 10:00", as a round's time is written elsewhere. */
const stamp = (iso: string | null | undefined) => {
  const p = londonParts(iso);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
};

const dialogNamed = async (page: Page, title: string) => {
  const dialog = page.locator(".mantine-Modal-content");
  await expect(dialog.getByText(title)).toBeVisible();
  await dialog.getByText(title).click(); // also waits for it to stop moving
  return dialog;
};
const pickWho = async (page: Page, dialog: Locator, option: string) => {
  await dialog
    .getByLabel(/^Who needed the change\?/)
    .first()
    .click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
/** Mark the round from the application page's Reschedule dialog: no new time yet, a to-do due today. */
const markFromDialog = async (page: Page, label: string, reason: string) => {
  await page.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = await dialogNamed(page, `Reschedule ${label}`);
  await dialog.getByRole("checkbox", { name: "A new time isn't agreed yet" }).check();
  await expect(dialog.getByLabel("New time", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: "Add a to-do to book the new time" })).toBeChecked();
  await pickWho(page, dialog, "Them");
  await dialog.getByLabel("Why? (optional)").fill(reason);
  await dialog.getByRole("button", { name: "Save: needs a new time" }).click();
  await expect(dialog).toBeHidden();
};

test("a round marked as needing a new time shows on Today with its to-do, and setting the time is the move", async ({
  page,
  request,
}) => {
  const { appId, round, label } = await bookedRound(request, "Needs Time Co", "Needs time");
  await page.goto(`/applications/${appId}`);
  await markFromDialog(page, label, "Their manager is away");

  // Saved: the old time kept, who, and an open to-do due today.
  await expect.poll(async () => (await roundNow(request, round.id)).needs_new_time_since).not.toBeNull();
  const marked = await roundNow(request, round.id);
  expect(marked.starts_at).toBe(round.starts_at);
  expect(marked.rescheduled_count).toBe(0);
  const [todo] = await todosOf(request, appId);
  expect(todo).toMatchObject({
    id: marked.rebook_todo_id,
    text: `Book a new time for ${label}`,
    due_on: londonToday(),
    done_at: null,
  });

  // The application page: the badge, the old time and who, and the timeline entry.
  await expect(page.getByText("Needs a new time", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(`Was ${stamp(round.starts_at)}. They needed the change.`).first(),
  ).toBeVisible();
  await expect(
    page.getByText(`${label} needs a new time (they needed the change): Their manager is away`).first(),
  ).toBeVisible();

  // Today: in Your move, once, with its to-do; not coming up.
  await page.goto("/");
  const section = page.getByRole("group", { name: "Needs a new time" });
  await expect(section.getByText(label, { exact: true })).toBeVisible();
  await expect(
    section.locator(".mantine-Badge-root").getByText("Needs a new time", { exact: true }),
  ).toBeVisible();
  await expect(section.getByRole("checkbox", { name: `Book a new time for ${label}` })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: `Book a new time for ${label}` })).toHaveCount(1);
  await expect(page.locator("#coming-up").getByText(label)).toHaveCount(0);

  // Set the new time from Today.
  await section.getByRole("button", { name: `Set a new time for ${label}` }).click();
  const dialog = await dialogNamed(page, `Set a new time for ${label}`);
  await expect(
    dialog.getByText(
      "Setting it counts as the move from the old time, and ticks off any to-do made to book it.",
    ),
  ).toBeVisible();
  await dialog.getByLabel("New time", { exact: true }).first().click();
  await page.locator('[class*="DateTimePicker-day"]:not([data-outside])').last().click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();

  // One move, from the old time, with who and why; the to-do ticked off; nothing left to book.
  await expect.poll(async () => (await roundNow(request, round.id)).rescheduled_count).toBe(1);
  const booked = await roundNow(request, round.id);
  expect(booked.needs_new_time_since).toBeNull();
  expect(booked.moves).toHaveLength(1);
  expect(Date.parse(booked.moves[0]!.from_at)).toBe(Date.parse(round.starts_at!));
  expect(Date.parse(booked.moves[0]!.to_at)).toBe(Date.parse(booked.starts_at!));
  expect(booked.moves[0]).toMatchObject({ by: "them", reason: "Their manager is away" });
  await expect.poll(async () => (await todosOf(request, appId))[0]?.done_at).not.toBeNull();
  await expect(page.getByRole("group", { name: "Needs a new time" })).toHaveCount(0);

  // The timeline line for the move, from the old time to the new one.
  await page.goto(`/applications/${appId}`);
  await expect(
    page.getByText(
      `Moved from ${dayTime(round.starts_at)} to ${dayTime(booked.starts_at)} · They needed the change · Their manager is away`,
    ),
  ).toBeVisible();
  await expect(page.getByText("Needs a new time", { exact: true })).toHaveCount(0);
});

test("Undo gives the round its old time back and removes the to-do", async ({ page, request }) => {
  const { appId, round, label } = await bookedRound(request, "Undo Time Co", "Undo time");
  await page.goto(`/applications/${appId}`);
  await markFromDialog(page, label, "A clash");
  const toast = page.locator(".mantine-Notification-root").filter({ hasText: `${label} needs a new time.` });
  await toast.getByRole("button", { name: "Undo" }).click();

  await expect.poll(async () => (await roundNow(request, round.id)).needs_new_time_since).toBeNull();
  expect((await roundNow(request, round.id)).starts_at).toBe(round.starts_at);
  await expect.poll(async () => (await todosOf(request, appId)).length).toBe(0);
  await expect(page.getByText(`${label} no longer needs a new time`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Reschedule ${label}` })).toBeVisible();
});

test("the board, the quick view and the Interviews page show it too", async ({ page, request }) => {
  const { appId, round, label } = await bookedRound(request, "Shown Time Co", "Shown time");
  const marked = await request.post(`${API}/interviews/${round.id}/needs-new-time`, { data: { by: "me" } });
  expect(marked.ok()).toBe(true);

  await page.goto("/interviews?view=list");
  const waiting = page.getByRole("heading", { name: "Needs a new time" }).locator("xpath=..");
  await expect(waiting.getByText(label)).toBeVisible();
  await expect(waiting.getByText(`Was ${stamp(round.starts_at)}. You needed the change.`)).toBeVisible();
  await expect(waiting.getByRole("button", { name: `Set a new time for ${label}` })).toBeVisible();

  // The round's badge, and beside it one saying it needs a new time.
  const needsOne = (within: Page | Locator) =>
    within
      .locator("[data-round-pill]")
      .filter({ hasText: label })
      .locator("xpath=..")
      .locator('[data-round-state="needsNewTime"]');
  await page.goto("/applications?view=board");
  await expect(needsOne(page)).toHaveText("Needs a new time");

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Shown Time Co" });
  await expect(needsOne(row)).toHaveText("Needs a new time");
  await row.click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Shown Time Co" });
  await expect(needsOne(drawer)).toHaveText("Needs a new time");
  await expect(drawer.getByRole("button", { name: `Set a new time for ${label}` })).toBeVisible();

  await page.goto(`/applications/${appId}`);
  await expect(page.getByRole("button", { name: `Set a new time for ${label}` })).toBeVisible();

  // Its old time cleared on the form: it still says why, and can still be given a time.
  const cleared = await request.patch(`${API}/interviews/${round.id}`, { data: { starts_at: null } });
  expect(cleared.ok()).toBe(true);
  await page.reload();
  await expect(page.getByText("It has no time now. You needed the change.")).toBeVisible();
  await expect(page.getByRole("button", { name: `Set a new time for ${label}` })).toBeVisible();
});

test("Cancel saves nothing, and Keep the old time takes the mark back", async ({ page, request }) => {
  const { appId, round, label } = await bookedRound(request, "Keep Time Co", "Keep time");
  await page.goto(`/applications/${appId}`);
  await page.getByRole("button", { name: `Reschedule ${label}` }).click();
  let dialog = await dialogNamed(page, `Reschedule ${label}`);
  await dialog.getByRole("checkbox", { name: "A new time isn't agreed yet" }).check();
  await pickWho(page, dialog, "Me");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await roundNow(request, round.id)).needs_new_time_since).toBeNull();
  expect(await todosOf(request, appId)).toEqual([]);

  await markFromDialog(page, label, "Ill");
  await expect.poll(async () => (await todosOf(request, appId)).length).toBe(1);
  await page.getByRole("button", { name: `Set a new time for ${label}` }).click();
  dialog = await dialogNamed(page, `Set a new time for ${label}`);
  await dialog.getByRole("button", { name: "Keep the old time" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await roundNow(request, round.id)).needs_new_time_since).toBeNull();
  const kept = await roundNow(request, round.id);
  expect([kept.starts_at, kept.rescheduled_count]).toEqual([round.starts_at, 0]);
  await expect.poll(async () => (await todosOf(request, appId)).length).toBe(0); // unchanged, so deleted
  await expect(page.getByRole("button", { name: `Reschedule ${label}` })).toBeVisible();
});
