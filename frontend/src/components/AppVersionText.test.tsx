import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mockApi } from "../test/mockApi";
import { AppVersion, compareVersions, PAGE_VERSION } from "./AppVersion";

// The version in the menu's footer, from locales/en/common.ts. Made-up versions, so a version
// bump never breaks these.

const health = (version: string) => ({
  status: "ok",
  version,
  schema: "0014",
  schema_head: "0014",
  git_repo: true,
});

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the version", () => {
  it("is the build's own, from package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      version: string;
    };
    expect(PAGE_VERSION).toBe(pkg.version);
  });

  it("matching: shows it, linked to its release in a new tab, and nothing else", async () => {
    const calls = mockApi({ "/api/v1/health": health("4.5.6") });
    wrap(<AppVersion page="4.5.6" />);
    const link = screen.getByRole("link", {
      name: "v4.5.6: see what's in it on GitHub (opens in a new tab).",
    });
    expect(link).toHaveTextContent(/^v4\.5\.6$/);
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/waddington/job-application-tracker/releases/tag/v4.5.6",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await waitFor(() => expect(calls.map((c) => c.path)).toContain("/api/v1/health"));
    // Only the health check: the link is never fetched.
    expect(calls.every((c) => c.path.startsWith("/api/"))).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });

  it("an older server says to restart the tracker", async () => {
    mockApi({ "/api/v1/health": health("1.9.0") });
    wrap(<AppVersion page="1.10.0" />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /^The server is v1\.9\.0 but this page is v1\.10\.0\. Restart the tracker to update\.$/,
      ),
    );
    expect(screen.getByRole("link")).toHaveTextContent(/^v1\.10\.0$/);
  });

  it("an older page says to refresh it", async () => {
    mockApi({ "/api/v1/health": health("2.0.0") });
    wrap(<AppVersion page="1.10.3" />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /^The server is v2\.0\.0 but this page is v1\.10\.3\. Refresh this page to update\.$/,
      ),
    );
  });

  it("health failing: shows the page's version and claims nothing about the server", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<AppVersion page="4.5.6" />);
    expect(screen.getByRole("link")).toHaveTextContent(/^v4\.5\.6$/);
    // ApiStatus's query retries once (about a second) before giving up.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
    expect(screen.getByRole("link")).toHaveTextContent(/^v4\.5\.6$/);
  });
});

describe("comparing versions", () => {
  it("goes by number, part by part, not by string order", () => {
    expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.2.43", "1.8.0")).toBeLessThan(0);
    expect(compareVersions("1.8.0", "1.8.0")).toBe(0);
    expect(compareVersions("1.8", "1.8.0")).toBe(0);
    expect(compareVersions("1.8.0-dev", "1.8.0")).toBeNull();
  });
});
