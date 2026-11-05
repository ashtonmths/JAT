import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { i18n } from "../i18n";
import { STORAGE_KEY } from "../i18n/language";
import { makeRouter } from "../router";
import { mockApi } from "../test/mockApi";

// A draft language (DRAFT_LANGUAGES) in the language switch. The list is mocked with a made-up
// "xx" that has only its app name translated, so the test doesn't depend on the real drafts.
vi.mock("../i18n/language", async (original) => ({
  ...(await original<typeof import("../i18n/language")>()),
  DRAFT_LANGUAGES: { xx: "Xx" },
  isDraft: (code: string) => code === "xx",
}));

const HEALTH = { status: "ok", version: "1.1.3", schema: "0014", schema_head: "0014", git_repo: true };

beforeEach(() => {
  i18n.addResourceBundle("xx", "common", { app: { name: "Xx tracker" } });
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
  await i18n.changeLanguage("en");
  i18n.removeResourceBundle("xx", "common");
});

function openSwitch() {
  mockApi({ "/api/v1/health": HEALTH });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/no-such-page"] }))} />);
  return screen.findByRole("button", { name: "Language: English" }).then((button) => fireEvent.click(button));
}

describe("a draft language in the switch", () => {
  it("in dev, is offered by its name and switches the app, without being remembered", async () => {
    await openSwitch();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Xx (draft)", hidden: true }));
    // Its one translated line shows; everything else falls back to English.
    expect(await screen.findByRole("button", { name: "Language: Xx (draft)" })).toBeInTheDocument();
    expect(screen.getAllByText("Xx tracker").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe("xx");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("isn't offered in a built app", async () => {
    vi.stubEnv("DEV", false);
    await openSwitch();
    expect(await screen.findByRole("menuitem", { name: "English", hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Xx (draft)", hidden: true })).toBeNull();
  });
});
