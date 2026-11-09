import type { APIRequestContext } from "@playwright/test";

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

test("a round with no time says it's not booked yet, until it's booked", async ({ page, request }) => {
  const { roundId } = await withRound(request, "Unbooked Pill Co", { title: "Pill first chat" });

  await page.goto("/applications?view=board");
  await expect(page.getByText("Round 1 · Pill first chat · not booked yet")).toBeVisible();

  await page.goto("/applications?view=list");
  const row = page.getByRole("row").filter({ hasText: "Unbooked Pill Co" });
  await expect(row).toContainText("Round 1 · Pill first chat · not booked yet");

  // Booked, it gives its day instead.
  await patch(request, `interviews/${roundId}`, { starts_at: inDays(3) });
  await page.goto("/applications?view=board");
  const card = page.getByText(/^Round 1 · Pill first chat · /).filter({ hasNotText: "not booked yet" });
  await expect(card.first()).toBeVisible();
  await expect(page.getByText("Round 1 · Pill first chat · not booked yet")).toBeHidden();
});

test("a done round with nothing since says it's waiting to hear back", async ({ page, request }) => {
  const { appId, roundId } = await withRound(request, "Waiting Pill Co", {
    title: "Pill tech chat",
    starts_at: inDays(-2),
  });
  await patch(request, `interviews/${roundId}`, { status: "done" });
  const waiting = "Round 1 · Pill tech chat · waiting to hear back";

  await page.goto("/applications?view=board");
  await expect(page.getByText(waiting)).toBeVisible();

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
