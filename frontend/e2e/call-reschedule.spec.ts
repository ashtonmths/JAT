import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Rescheduling a booked call: the same dialog as a round's, from the person page and Today, who
// needed the change and why, and where each move shows. Each test makes its own person.

interface Move {
  from_at: string;
  to_at: string | null;
  by: string | null;
  reason: string | null;
}
interface Call {
  id: string;
  starts_at: string;
  ends_at: string | null;
  rescheduled_count: number;
  moves: Move[];
}

const API = "/api/v1";
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 60_000) * 60_000).toISOString();
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
/** A person and a call booked with them, `days` from now; about an application when `appId` is given. */
const bookedCall = async (request: APIRequestContext, name: string, days: number, appId?: string) => {
  const person = await post<{ id: string }>(request, "contacts", { name });
  const call = await post<Call>(request, "meetings", {
    contact_id: person.id,
    title: "Catch-up",
    starts_at: inDays(days),
    ends_at: inDays(days + 1 / 48),
    ...(appId ? { application_id: appId } : {}),
  });
  return { personId: person.id, call, label: `Call with ${name}: Catch-up` };
};
const callNow = async (request: APIRequestContext, id: string) =>
  (await (await request.get(`${API}/meetings/${id}`)).json()) as Call;

const openDialog = async (page: Page, label: string, within: Page | Locator = page) => {
  await within.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await dialog.getByText(`Reschedule ${label}`).click(); // also waits for it to stop moving
  return dialog;
};
/** A day next to the current one, so a call on Today stays within its two weeks. */
const moveOneDay = async (page: Page, dialog: Locator) => {
  await dialog.getByLabel("New time", { exact: true }).first().click();
  const days = page.locator('[class*="DateTimePicker-day"]:not([data-outside])');
  const selected = await days.evaluateAll((all) => all.findIndex((d) => d.hasAttribute("data-selected")));
  await days.nth(selected > 0 ? selected - 1 : selected + 1).click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
};
/** Two days after the current one (a call from yesterday lands tomorrow), into next month if need be. */
const moveTwoDaysOn = async (page: Page, dialog: Locator) => {
  await dialog.getByLabel("New time", { exact: true }).first().click();
  const days = page.locator('[class*="DateTimePicker-day"]:not([data-outside])');
  const selected = await days.evaluateAll((all) => all.findIndex((d) => d.hasAttribute("data-selected")));
  const count = await days.count();
  if (selected + 2 < count) {
    await days.nth(selected + 2).click();
  } else {
    await page.locator('[data-direction="next"]').first().click();
    await days.nth(selected + 2 - count).click();
  }
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
};
const pickWho = async (page: Page, dialog: Locator, option: string) => {
  await dialog
    .getByLabel(/^Who needed the change\?/)
    .first()
    .click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const submit = (dialog: Locator) => dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
/** "Tue 3 Nov, 10:00", as a move's line writes it (the page runs in Europe/London). */
const dayTime = (iso: string | null | undefined) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso ?? ""));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("weekday")} ${part("day")} ${part("month")}, ${part("hour")}:${part("minute")}`;
};

test.describe("rescheduling a call", () => {
  test("from the person page: who and why kept with the move, shown on the Timeline", async ({
    page,
    request,
  }) => {
    const { personId, call, label } = await bookedCall(request, "Riley Moved", 9);
    await page.goto(`/people/${personId}`);
    const dialog = await openDialog(page, label);
    await expect(dialog.getByText(/^Booked for /)).toBeVisible();
    await moveOneDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("Their manager is away");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Rescheduled", { exact: true })).toBeVisible();

    const saved = await callNow(request, call.id);
    expect(saved.rescheduled_count).toBe(1);
    expect(saved.moves).toEqual([
      {
        from_at: call.starts_at.replace(".000", ""),
        to_at: saved.starts_at,
        by: "them",
        reason: "Their manager is away",
      },
    ]);
    // It keeps its length.
    expect(Date.parse(saved.ends_at ?? "") - Date.parse(saved.starts_at)).toBe(30 * 60_000);

    // The Timeline says the call once, then the move's times, who and why.
    await page.goto("/timeline");
    const line = `Moved from ${dayTime(call.starts_at)} to ${dayTime(saved.starts_at)} · They needed the change · Their manager is away`;
    await expect(page.getByText(`${label} rescheduled`, { exact: true })).toHaveCount(1);
    // The line under this call's own title, not another entry's.
    const row = page.getByText(`${label} rescheduled`, { exact: true }).locator("..");
    await expect(row.getByText(line, { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${label} rescheduled .`))).toHaveCount(0);
  });

  test("asks who needed the change, and Cancel saves nothing", async ({ page, request }) => {
    const { personId, call, label } = await bookedCall(request, "Sam Unsure", 9);
    await page.goto(`/people/${personId}`);
    let dialog = await openDialog(page, label);
    const reschedule = dialog.getByRole("button", { name: "Reschedule", exact: true });
    await expect(reschedule).toBeDisabled(); // the same time isn't a move
    await moveOneDay(page, dialog);
    await submit(dialog);
    await expect(dialog.getByText("Choose who needed the change")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect((await callNow(request, call.id)).rescheduled_count).toBe(0);

    // It reopens empty, with the booked time.
    dialog = await openDialog(page, label);
    await expect(dialog.getByLabel("Why? (optional)")).toHaveValue("");
    await expect(dialog.getByLabel(/^Who needed the change\?/).first()).toHaveValue("");
  });

  test("from Today, for a call coming up and one whose time has passed", async ({ page, request }) => {
    const soon = await bookedCall(request, "Taylor Soon", 3);
    const past = await bookedCall(request, "Jordan Past", -1);
    await page.goto("/");
    const dialog = await openDialog(page, soon.label);
    await moveOneDay(page, dialog);
    await pickWho(page, dialog, "Me");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await callNow(request, soon.call.id)).moves.map((m) => m.by))
      .toEqual(["me"]);

    // How did it go? offers it beside Happened and Didn't happen: a call that was missed moves ahead.
    await expect(page.getByRole("button", { name: `Happened: ${past.label}` })).toBeVisible();
    const missed = await openDialog(page, past.label);
    await moveTwoDaysOn(page, missed);
    await pickWho(page, missed, "Them");
    await missed.getByLabel("Why? (optional)").fill("They missed it");
    await submit(missed);
    await expect(missed).toBeHidden();
    const moved = await callNow(request, past.call.id);
    expect(moved.moves).toEqual([
      {
        from_at: past.call.starts_at.replace(".000", ""),
        to_at: moved.starts_at,
        by: "them",
        reason: "They missed it",
      },
    ]);
    expect(Date.parse(moved.starts_at)).toBeGreaterThan(Date.now());
    // It's no longer waiting for how it went.
    await expect(page.getByRole("button", { name: `Happened: ${past.label}` })).toHaveCount(0);
  });

  test("a call about an application: the move is on its timeline once", async ({ page, request }) => {
    const app = await post<{ id: string }>(request, "applications/quick", {
      company_name: "Call Move Co",
      role_title: "Tested Role",
      route: "direct",
      tags: [],
    });
    const { personId, call, label } = await bookedCall(request, "Casey Linked", 9, app.id);
    await page.goto(`/people/${personId}`);
    const dialog = await openDialog(page, label);
    await moveOneDay(page, dialog);
    await pickWho(page, dialog, "Both of us");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    const saved = await callNow(request, call.id);
    const line = `Moved from ${dayTime(call.starts_at)} to ${dayTime(saved.starts_at)} · You both needed the change`;

    for (const path of [`/applications/${app.id}`, "/timeline"]) {
      await page.goto(path);
      await expect(page.getByText(line, { exact: true })).toHaveCount(1);
      await expect(page.getByText(`${label} rescheduled`, { exact: true })).toHaveCount(1);
    }
  });

  test("a call that happened has no Reschedule", async ({ page, request }) => {
    const { personId, call, label } = await bookedCall(request, "Morgan Done", -2);
    const done = await request.patch(`${API}/meetings/${call.id}`, { data: { status: "done" } });
    expect(done.ok()).toBe(true);
    await page.goto(`/people/${personId}`);
    await expect(page.getByText(label)).toBeVisible();
    await expect(page.getByRole("button", { name: `Reschedule ${label}` })).toHaveCount(0);
  });
});
