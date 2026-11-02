import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";

// Insights' recruiter conversations: calls moved, by who needed it, and calls waiting for a new
// time, which count as neither held nor booked ahead. Its own file, so its own fresh demo data
// (which has no moved calls): the counts are exact.

const API = "/api/v1";
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 60_000) * 60_000).toISOString();
const ok = async (made: Promise<{ ok(): boolean; json(): Promise<unknown> }>) => {
  const r = await made;
  expect(r.ok()).toBe(true);
  return (await r.json()) as { id: string };
};
const call = async (request: APIRequestContext, contactId: string, days: number) =>
  ok(
    request.post(`${API}/meetings`, {
      data: { contact_id: contactId, title: "Catch-up", starts_at: inDays(days) },
    }),
  );

test("calls moved, who needed it, and waiting calls show in recruiter conversations", async ({
  page,
  request,
}) => {
  const person = await ok(request.post(`${API}/contacts`, { data: { name: "Morgan Moves" } }));
  const before = (await (await request.get(`${API}/insights/conversations`)).json()) as {
    total: { calls_booked: number };
  };
  const twice = await call(request, person.id, 3);
  for (const [days, by] of [
    [4, "them"],
    [5, undefined],
  ] as const) {
    await ok(
      request.patch(`${API}/meetings/${twice.id}`, {
        data: { starts_at: inDays(days), ...(by ? { reschedule_by: by } : {}) },
      }),
    );
  }
  const waiting = await call(request, person.id, 6);
  await ok(request.post(`${API}/meetings/${waiting.id}/needs-new-time`, { data: { by: "me" } }));

  await page.goto("/insights");
  await page.getByRole("tab", { name: "Recruiter conversations", exact: true }).click();
  await expect(
    page.getByText(
      "2 calls were moved to another time. That's 3 moves in all: a call that moves twice is one call and two moves. 1 call is waiting for a new time: it counts as moved, but not as held or booked ahead.",
    ),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Calls moved" });
  await expect(table.getByRole("row", { name: "Me 1" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Them 1" })).toBeVisible();
  await expect(table.getByRole("row", { name: "Not recorded 1" })).toBeVisible();
  await expect(page.getByText(/^Not recorded means the app doesn't know who/)).toBeVisible();

  // The waiting call isn't booked ahead; the one moved twice is.
  const after = (await (await request.get(`${API}/insights/conversations`)).json()) as {
    total: { calls_booked: number; calls_waiting: number };
  };
  expect(after.total.calls_booked).toBe(before.total.calls_booked + 1);
  expect(after.total.calls_waiting).toBe(1);
});
