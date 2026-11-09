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
 * The English the app writes itself. Short strings ("CV", "OK") and ones Chinese keeps as they
 * are ("Offer", "Markdown") aren't a sign of anything left untranslated. A string with values
 * ("{{count}} days ago") becomes a pattern with each value as a wildcard; one with <tags> is
 * split into the words around them by the page, so it's left to the whole-string check.
 */
const chinese = new Set(strings(zhCN));
const english = strings(en).filter((s) => s.trim().length > 3 && !chinese.has(s) && /[a-z]/.test(s));
const ENGLISH = new Set(english.filter((s) => !/[{<]/.test(s)));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ENGLISH_PATTERNS = english
  .filter((s) => s.includes("{{") && !s.includes("<"))
  .map((s) => s.split(/\{\{[^}]+\}\}/))
  // At least two English words outside the values, or "{{name}}" alone would match anything.
  .filter((parts) => (parts.join(" ").match(/[A-Za-z]{2,}/g) ?? []).length >= 2)
  .map((parts) => new RegExp(`^${parts.map(escape).join(".+")}$`));
const isEnglish = (text: string) => ENGLISH.has(text) || ENGLISH_PATTERNS.some((re) => re.test(text));

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
    for (const el of document.querySelectorAll("[aria-label], [placeholder], [title], img[alt]")) {
      for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
        const value = el.getAttribute(attr)?.trim();
        if (value) out.push(value);
      }
    }
    // What's shown in a box you type into or pick from (a checkbox's value is a hidden code).
    for (const input of document.querySelectorAll("input:not([type=checkbox], [type=radio], [type=hidden])"))
      if ((input as HTMLInputElement).value.trim()) out.push((input as HTMLInputElement).value.trim());
    out.push(document.title);
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
    const get = async <T>(path: string) => (await (await request.get(`/api/v1/${path}`)).json()) as T;
    const apps = await get<{ id: string; company_name: string; role_id: string }[]>("applications");
    const named = async (what: string, name: string) => {
      const row = (await get<{ id: string; name: string }[]>(what)).find((r) => r.name === name);
      expect(row, `${name} in ${what}`).toBeTruthy();
      return row!.id;
    };
    const contoso = apps.find((a) => a.company_name === "Contoso")!;
    const agencies = await get<{ id: string }[]>("agencies");
    expect(agencies.length, "the demo data has an agency").toBeGreaterThan(0);
    const detailPages = [
      `/applications/${contoso.id}`,
      `/roles/${contoso.role_id}`,
      `/companies/${await named("companies", "Contoso")}`,
      `/people/${await named("contacts", "Alex Morgan")}`,
      `/agencies/${agencies[0]!.id}`,
      "/no-such-page",
    ];
    // Your data stays as you wrote it, and the demo's is English: a role called "Senior Backend
    // Engineer" or a tag "remote" is data, even where the catalog uses the same words as an example.
    // The API also sends English the app translates itself (default stage names): not data.
    const data = new Set<string>();
    for (const what of [
      "applications",
      "contacts",
      "companies",
      "agencies",
      "documents",
      "interviews",
      "offers",
      "notes",
    ]) {
      for (const s of strings(await (await request.get(`/api/v1/${what}`)).json())) data.add(s.trim());
    }
    for (const app of apps) {
      const links = await request.get(`/api/v1/links?entity_type=application&entity_id=${app.id}`);
      for (const s of strings(await links.json())) data.add(s.trim());
    }
    for (const s of strings(en.stages)) data.delete(s);
    // Search highlights split a title into pieces, so there (only) a piece of your data is data
    // too: elsewhere a note saying "Applied via LinkedIn" mustn't hide an untranslated "Applied".
    const isData = (text: string, path: string) =>
      data.has(text) ||
      (path.startsWith("/search") && [...data].some((d) => d.length > text.length && d.includes(text)));
    const left: Record<string, string[]> = {};
    for (const path of [...PAGES, ...detailPages]) {
      await page.goto(path);
      // The page's own heading, past the app's name in the header (an application's is level 3),
      // then nothing still loading.
      await expect(page.getByRole("heading").nth(1)).toBeVisible();
      await expect(page.locator(".mantine-Loader-root, .mantine-Skeleton-root")).toHaveCount(0);
      const english = (await textOnScreen(page)).filter((text) => isEnglish(text) && !isData(text, path));
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
