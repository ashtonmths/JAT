import { readdirSync, readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import en from "../src/locales/en";
import { expect, test } from "./fixtures";

// The Chinese files are JSON, which the browser tests' Node can't import as the app's bundler does.
const ZH_DIR = new URL("../src/locales/zh-CN/", import.meta.url);
const zhCN = readdirSync(ZH_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, ZH_DIR), "utf8")) as unknown);

// Simplified Chinese, switched on: choosing it, a Chinese browser getting it, and every page in
// it with no English left of the app's own text. The demo data stays English (Contoso, Alex
// Morgan), so the check compares what's on screen with the English catalog, not with Latin letters.

/** Every string in a catalog, flattened. */
function strings(tree: unknown): string[] {
  if (typeof tree === "string") return [tree];
  if (tree && typeof tree === "object") return Object.values(tree).flatMap(strings);
  return [];
}

/**
 * The English the app writes itself, as whole strings: those with a {{value}} or <tag> can't be
 * matched whole, and short ones ("CV", "OK") or ones Chinese keeps as they are ("Offer",
 * "Markdown") aren't a sign of anything left untranslated.
 */
const chinese = new Set(strings(zhCN));
const ENGLISH = new Set(
  strings(en).filter((s) => !/[{<]/.test(s) && s.trim().length > 3 && !chinese.has(s) && /[a-z]/.test(s)),
);

/** The page's visible text pieces, and the labels a screen reader or a tooltip would give. */
async function textOnScreen(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      const el = node.parentElement;
      if (!el || el.closest("script, style, [hidden], [aria-hidden=true]")) continue;
      const text = node.textContent?.trim();
      if (text) out.push(text);
    }
    for (const el of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
      for (const attr of ["aria-label", "placeholder", "title"]) {
        const value = el.getAttribute(attr)?.trim();
        if (value) out.push(value);
      }
    }
    return out;
  });
}

const PAGES = [
  "/",
  "/roles",
  "/applications",
  "/applications?view=board",
  "/interviews",
  "/offers",
  "/recruiters",
  "/companies",
  "/documents",
  "/notes",
  "/insights",
  "/timeline",
  "/search?q=Contoso",
];

test.describe("a browser set to Simplified Chinese", () => {
  test.use({ locale: "zh-CN" });

  test("gets Chinese without choosing it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("button", { name: "语言：简体中文" })).toBeVisible();
  });

  test("every page is in Chinese, with no English of the app's own left", async ({ page, request }) => {
    const apps = (await (await request.get("/api/v1/applications")).json()) as {
      id: string;
      company_name: string;
    }[];
    const people = (await (await request.get("/api/v1/contacts")).json()) as { id: string }[];
    const contoso = apps.find((a) => a.company_name === "Contoso")!;
    // Your data stays as you wrote it, and the demo's is English: a role called "Senior Backend
    // Engineer" or a tag "remote" is data, even where the catalog uses the same words as an example.
    const data = new Set<string>();
    for (const what of [
      "applications",
      "contacts",
      "companies",
      "agencies",
      "documents",
      "interviews",
      "offers",
    ]) {
      for (const s of strings(await (await request.get(`/api/v1/${what}`)).json())) data.add(s.trim());
    }
    for (const app of apps) {
      const links = await request.get(`/api/v1/links?entity_type=application&entity_id=${app.id}`);
      for (const s of strings(await links.json())) data.add(s.trim());
    }
    const left: Record<string, string[]> = {};
    for (const path of [...PAGES, `/applications/${contoso.id}`, `/people/${people[0]!.id}`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // The page's own heading, past the app's name in the header (an application's is level 3).
      await expect(page.getByRole("heading").nth(1)).toBeVisible();
      const english = (await textOnScreen(page)).filter((text) => ENGLISH.has(text) && !data.has(text));
      if (english.length) left[path] = [...new Set(english)];
    }
    expect(left).toEqual({});
  });
});

test.describe("an English browser", () => {
  test("can choose 简体中文, and it's remembered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Language" }).click();
    await page.getByRole("menuitem", { name: "简体中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { name: "轮到你" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("jat.language"))).toBe("zh-CN");
    await page.reload();
    await expect(page.getByRole("heading", { name: "轮到你" })).toBeVisible();
    // And back.
    await page.getByRole("button", { name: "语言：简体中文" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  });
});
