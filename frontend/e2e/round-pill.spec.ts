import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The round pill on the board, the list and the quick view says what the round needs: booking
// (no time yet) or an answer (done, with nothing heard since). Each test makes its own application.

const API = "/api/v1";
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 1000) * 1000).toISOString();
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const patch = async (request: APIRequestContext, path: string, data: object) => {
  const changed = await request.patch(`${API}/${path}`, { data });
  expect(changed.ok(), `PATCH ${path}`).toBe(true);
};
const withRound = async (request: APIRequestContext, company: string, round: object) => {
  const app = await post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: "Pill Role",
    route: "direct",
    tags: [],
  });
  const made = await post<{ id: string }>(request, `applications/${app.id}/interviews`, round);
  return { appId: app.id, roundId: made.id };
};

/** A round's own badge, by its text: always violet. */
const roundPill = (within: Page | Locator, text: string | RegExp) =>
  within.locator("[data-round-pill]").filter({ hasText: text });
/** The badge beside a round's own badge saying what it's waiting for, if any. */
const stateOf = (pill: Locator) => pill.locator("xpath=..").locator("[data-round-state]");

const expectViolet = (badge: Locator) => expect(badge).toHaveAttribute("style", /--mantine-color-violet-/);
const expectPink = (badge: Locator) => expect(badge).toHaveAttribute("style", /--mantine-color-pink-/);

test("a round with no time says it's not booked yet, until it's booked", async ({ page, request }) => {
  const { roundId } = await withRound(request, "Unbooked Pill Co", { title: "Pill first chat" });

  await page.goto("/applications?view=board");
  const unbooked = roundPill(page, "Round 1 · Pill first chat");
  await expect(unbooked).toHaveText("Round 1 · Pill first chat"); // just the round
  await expectViolet(unbooked);
  await expect(stateOf(unbooked)).toHaveText("Not booked yet");
  await expect(stateOf(unbooked)).toHaveAttribute("data-round-state", "notBooked");
  await expectPink(stateOf(unbooked));

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Unbooked Pill Co" });
  await expect(stateOf(roundPill(row, "Round 1 · Pill first chat"))).toHaveText("Not booked yet");

  // Booked, the round gives its day and nothing sits beside it.
  await patch(request, `interviews/${roundId}`, { starts_at: inDays(3) });
  await page.goto("/applications?view=board");
  const booked = roundPill(page, /^Round 1 · Pill first chat · /);
  await expect(booked).toBeVisible();
  await expectViolet(booked);
  await expect(stateOf(booked)).toHaveCount(0);
});

test("a done round with nothing since says it's waiting to hear back", async ({ page, request }) => {
  const { appId, roundId } = await withRound(request, "Waiting Pill Co", {
    title: "Pill tech chat",
    starts_at: inDays(-2),
  });
  await patch(request, `interviews/${roundId}`, { status: "done" });
  const name = "Round 1 · Pill tech chat";

  await page.goto("/applications?view=board");
  const pill = roundPill(page, name);
  await expect(pill).toHaveText(name);
  await expectViolet(pill);
  await expect(stateOf(pill)).toHaveText("Waiting to hear back");
  await expectPink(stateOf(pill));

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Waiting Pill Co" });
  await expect(stateOf(roundPill(row, name))).toHaveText("Waiting to hear back");
  await row.click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Waiting Pill Co" });
  await expect(stateOf(roundPill(drawer, name))).toHaveText("Waiting to hear back");

  await page.goto(`/applications/${appId}`);
  await expect(page.getByText(`${name}: waiting to hear back`)).toBeVisible();

  // Moved on a stage since: they've decided, so it's just the round, with nothing beside it.
  await post(request, `applications/${appId}/move`, { to_stage: "applied" });
  await page.goto("/applications?view=board");
  await expect(roundPill(page, name)).toBeVisible();
  await expect(stateOf(roundPill(page, name))).toHaveCount(0);
});
