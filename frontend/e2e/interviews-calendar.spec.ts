import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Interviews calendar: the first view, a round's details on hover and kept open on click, moving
// between months and weeks, and a phone's agenda. Each test makes its own application.

const API = "/api/v1";

/** Today at a local time, so the round is on this month's and this week's calendar. */
const todayAt = (hours: number, minutes = 0) => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  return { appId: id, label: `Round 1 · ${title}`, chip: `Round 1 · ${title}, ${company}, 23:30` };
};

const openCalendar = async (page: Page) => {
  await page.goto("/interviews");
  await expect(page.getByRole("button", { name: /^(Previous month|Previous week)$/ })).toBeVisible();
};

test("the calendar is the first view; hovering a round shows its details, a click keeps them open", async ({
  page,
  request,
}) => {
  const { appId, label, chip } = await bookedToday(request, "Calendar Hover Co", "Hover check");
  await openCalendar(page);
  const today = page.locator(`[data-day="${localDay()}"]`);
  const round = today.getByRole("button", { name: chip });
  await expect(round).toBeVisible();

  // Hover: the details, with the round's own actions and a way to the application.
  await round.hover();
  const card = page.locator(".mantine-Popover-dropdown").filter({ hasText: "Calendar Hover Co" });
  await expect(card.getByText(label)).toBeVisible();
  await expect(card.getByRole("link", { name: "Open the application" })).toHaveAttribute(
    "href",
    `/applications/${appId}`,
  );
  await expect(card.getByRole("button", { name: `Reschedule ${label}` })).toBeVisible();
  await page.mouse.move(2, 2);
  await expect(card).toBeHidden();

  // Keyboard focus shows it too.
  await round.focus();
  await expect(card.getByText(label)).toBeVisible();
  await round.blur();
  await expect(card).toBeHidden();

  // A click keeps it open after the mouse leaves; its actions are the list's.
  await round.click();
  await page.mouse.move(2, 2);
  await expect(card.getByText(label)).toBeVisible();
  await card.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await expect(dialog.getByText(`Reschedule ${label}`)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // The list is a click away, and stays chosen.
  await page.keyboard.press("Escape");
  await page.getByText("List", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
});

test("previous, next and today move by a month or a week, with that period's figures", async ({
  page,
  request,
}) => {
  const { chip } = await bookedToday(request, "Calendar Nav Co", "Navigation check");
  await openCalendar(page);
  const heading = page.getByRole("heading", { level: 3 });
  const thisMonth = (await heading.textContent()) ?? "";
  const summary = page.getByRole("region", { name: `Summary for ${thisMonth}` });
  await expect(summary.locator('[data-stat="comingUp"]')).toBeVisible();

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(heading).not.toHaveText(thisMonth);
  await expect(page.getByRole("button", { name: chip })).toBeHidden();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(heading).toHaveText(thisMonth);
  await expect(page.getByRole("button", { name: chip })).toBeVisible();

  // A week, Monday to Sunday, remembered.
  await page.getByText("Week", { exact: true }).click();
  await expect(heading).toHaveText(/ – /);
  await expect(page.locator("[data-day]")).toHaveCount(7);
  await expect(page.locator("[data-day]").first()).toHaveAttribute("data-day", /\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("button", { name: chip })).toBeVisible();
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page.getByRole("button", { name: chip })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Next week" })).toBeVisible();
});

test("on a phone the month is an agenda, with no sideways scroll", async ({ page, request }) => {
  const { chip, label } = await bookedToday(request, "Calendar Phone Co", "Phone check");
  await page.setViewportSize({ width: 375, height: 760 });
  await openCalendar(page);
  const round = page.getByRole("button", { name: chip });
  await expect(round).toBeVisible();
  await expect(round).toContainText(label);
  // Only days with rounds are listed, so today's is there and no empty grid.
  await expect(page.locator(`[data-day="${localDay()}"]`)).toBeVisible();
  await expect(page.locator("[data-day]")).toHaveCount(await page.locator("[data-day]:has(button)").count());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await round.click();
  await expect(
    page.locator(".mantine-Popover-dropdown").filter({ hasText: "Calendar Phone Co" }).getByText(label),
  ).toBeVisible();
});
