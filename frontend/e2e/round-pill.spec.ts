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

/** A round pill, by its text. */
const pill = (page: Page, text: string | RegExp) =>
  page.locator("[data-round-state]").filter({ hasText: text });
/** A round waiting for a time or an answer: pink, apart from a booked round's violet. */
const expectInBetween = async (badge: Locator) => {
  await expect(badge).toHaveAttribute("data-round-state", "in-between");
  await expect(badge).toHaveAttribute("style", /--mantine-color-pink-/);
};

test("a round with no time says it's not booked yet, until it's booked", async ({ page, request }) => {
  const { roundId } = await withRound(request, "Unbooked Pill Co", { title: "Pill first chat" });

  await page.goto("/applications?view=board");
  const unbooked = pill(page, "Round 1 · Pill first chat · not booked yet");
  await expect(unbooked).toBeVisible();
  await expectInBetween(unbooked);

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Unbooked Pill Co" });
  await expect(row).toContainText("Round 1 · Pill first chat · not booked yet");

  // Booked, it gives its day instead, in the booked round's violet.
  await patch(request, `interviews/${roundId}`, { starts_at: inDays(3) });
  await page.goto("/applications?view=board");
  const booked = pill(page, /^Round 1 · Pill first chat · /);
  await expect(booked).toBeVisible();
  await expect(booked).not.toContainText("not booked yet");
  await expect(booked).toHaveAttribute("data-round-state", "settled");
  await expect(booked).toHaveAttribute("style", /--mantine-color-violet-/);
});

test("a done round with nothing since says it's waiting to hear back", async ({ page, request }) => {
  const { appId, roundId } = await withRound(request, "Waiting Pill Co", {
    title: "Pill tech chat",
    starts_at: inDays(-2),
  });
  await patch(request, `interviews/${roundId}`, { status: "done" });
  const waiting = "Round 1 · Pill tech chat · waiting to hear back";

  await page.goto("/applications?view=board");
  await expect(pill(page, waiting)).toBeVisible();
  await expectInBetween(pill(page, waiting));

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Waiting Pill Co" });
  await expect(row).toContainText(waiting);
  await row.click();
  const drawer = page.getByRole("dialog").filter({ hasText: "Waiting Pill Co" });
  await expect(drawer.getByText(waiting)).toBeVisible();

  await page.goto(`/applications/${appId}`);
  await expect(page.getByText("Round 1 · Pill tech chat: waiting to hear back")).toBeVisible();

  // Moved on a stage since: they've decided, so it's just the round's name again.
  await post(request, `applications/${appId}/move`, { to_stage: "applied" });
  await page.goto("/applications?view=board");
  await expect(page.getByText("Round 1 · Pill tech chat", { exact: true })).toBeVisible();
  await expect(page.getByText(waiting)).toBeHidden();
});
