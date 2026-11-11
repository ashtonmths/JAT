import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Interviews calendar: a month of dots (the first view) or a year of small months, the chosen
// day's rounds in a panel beside with their actions, and a phone's layout. Each test makes its own
// application.

const API = "/api/v1";

/** Today at a local time, so the round is on this month's and this year's calendar. */
const todayAt = (hours: number, minutes = 0) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** "Thursday 12 November", as the app writes a day. */
const dayName = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday} ${d.getDate()} ${month}`;
};

const bookedToday = async (request: APIRequestContext, company: string, title: string) => {
  const app = await request.post(`${API}/applications/quick`, {
    data: { company_name: company, role_title: "Calendar Role", route: "direct", tags: [] },
  });
  expect(app.ok()).toBe(true);
  const { id } = (await app.json()) as { id: string };
  const round = await request.post(`${API}/applications/${id}/interviews`, {
    data: { title, starts_at: todayAt(23, 30), format: "video" },
  });
  expect(round.ok()).toBe(true);
  return { appId: id, label: `Round 1 · ${title}` };
};

const openCalendar = async (page: Page) => {
  await page.goto("/interviews");
  await expect(page.getByRole("button", { name: /^(Previous month|Previous year)$/ })).toBeVisible();
};
const panelOf = (page: Page) => page.getByRole("region", { name: "Rounds on the chosen day" });
const todaysDot = (page: Page) => page.locator(`button[data-day="${localDay()}"]`);

test("the month is the first view; choosing a day lists its rounds, with their actions", async ({
  page,
  request,
}) => {
  const { appId, label } = await bookedToday(request, "Calendar Panel Co", "Panel check");
  await openCalendar(page);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText(
    new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  );

  // Today has rounds (ours at least), so its dot is there and the panel can show it.
  await todaysDot(page).click();
  const panel = panelOf(page);
  await expect(panel.getByText(dayName(localDay()))).toBeVisible();
  const card = panel.locator("[data-round]").filter({ hasText: "Calendar Panel Co" });
  await expect(card.getByText(label)).toBeVisible();
  await expect(card.getByRole("link", { name: "Open the application" })).toHaveAttribute(
    "href",
    `/applications/${appId}`,
  );

  // The round's own actions, as on the list.
  await card.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await expect(dialog.getByText(`Reschedule ${label}`)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // The list is a click away, and stays chosen.
  await page.getByText("List", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
});

test("Year shows twelve months and the year's figures; previous, next and Today move by a year", async ({
  page,
  request,
}) => {
  const { label } = await bookedToday(request, "Calendar Year Co", "Year check");
  await openCalendar(page);
  await page.getByText("Year", { exact: true }).click();
  const heading = page.getByRole("heading", { level: 3 });
  const year = String(new Date().getFullYear());
  await expect(heading).toHaveText(year);
  await expect(page.locator(`section[aria-label$=' ${year}']:not([aria-label^='Summary'])`)).toHaveCount(12);
  await expect(
    page.getByRole("region", { name: `Summary for ${year}` }).locator('[data-stat="comingUp"]'),
  ).toBeVisible();

  // Choosing today's dot in the year fills the panel too.
  await todaysDot(page).click();
  await expect(panelOf(page).getByText(label)).toBeVisible();

  await page.getByRole("button", { name: "Next year" }).click();
  await expect(heading).toHaveText(String(Number(year) + 1));
  await expect(todaysDot(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(heading).toHaveText(year);

  // Remembered.
  await page.reload();
  await expect(page.getByRole("button", { name: "Previous year" })).toBeVisible();
});

test("on a phone nothing scrolls sideways, and the chosen day's rounds are near the top", async ({
  page,
  request,
}) => {
  const { label } = await bookedToday(request, "Calendar Phone Co", "Phone check");
  await page.setViewportSize({ width: 375, height: 760 });
  for (const view of ["Month", "Year"]) {
    await openCalendar(page);
    await page.getByText(view, { exact: true }).click();
    await todaysDot(page).click();
    await expect(panelOf(page).getByText(label)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  // In the year, the panel comes before the twelve months.
  const panelTop = (await panelOf(page).boundingBox())!.y;
  const januaryTop = (await page.locator("section[aria-label^='January']").boundingBox())!.y;
  expect(panelTop).toBeLessThan(januaryTop);
});
