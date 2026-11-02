import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi } from "../test/mockApi";
import { nodeName } from "./SankeyChart";

// The switch on Insights' Sankeys that expands Interviewing into its rounds.

const node = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  kind: "active",
  color: "indigo",
  reached: 1,
  current: 0,
  ...extra,
});

const FLOW = (rounds?: boolean) => ({
  applications: 1,
  nodes: [
    node("source:found", "You found it", { code: "source_found" }),
    node("interviewing", "Interviewing"),
    ...(rounds ? [node("interviewing#round-1", "Round 1", { code: "round", round: 1 })] : []),
    node("rejected", "Rejected", { kind: "closed", color: "red", current: 1 }),
  ],
  links: rounds
    ? [
        { source: "source:found", target: "interviewing", value: 1 },
        { source: "interviewing", target: "interviewing#round-1", value: 1 },
        { source: "interviewing#round-1", target: "rejected", value: 1 },
      ]
    : [
        { source: "source:found", target: "interviewing", value: 1 },
        { source: "interviewing", target: "rejected", value: 1 },
      ],
  ...(rounds === undefined ? {} : { rounds }),
});

function showInsights(serverExpands: boolean) {
  const calls = mockApi({
    "/api/v1/health": {},
    "/api/v1/insights/whole-flow": (url: URL) =>
      // An older server ignores ?rounds and sends no `rounds`.
      serverExpands ? FLOW(url.searchParams.get("rounds") === "true") : FLOW(undefined),
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/insights"] }))} />);
  return calls;
}

const wholeCalls = (calls: ReturnType<typeof mockApi>) =>
  calls.filter((c) => c.path.startsWith("/api/v1/insights/whole-flow"));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Show interview rounds", () => {
  it("names a round node in words", () => {
    expect(nodeName(node("interviewing#round-2", "Round 2", { code: "round", round: 2 }))).toBe("Round 2");
    // From the id, should a server leave the number out.
    expect(nodeName(node("onsite_interview#round-3", "Round 3", { code: "round" }))).toBe("Round 3");
  });

  it("is off at first; on, it asks for rounds, explains them and is remembered", async () => {
    const calls = showInsights(true);
    const toggle = await screen.findByRole("switch", { name: "Show interview rounds" });
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(wholeCalls(calls).length).toBeGreaterThan(0));
    expect(wholeCalls(calls).every((c) => !c.path.includes("rounds="))).toBe(true);
    fireEvent.click(toggle);
    await waitFor(() => expect(wholeCalls(calls).some((c) => c.path.includes("rounds=true"))).toBe(true));
    expect(
      await screen.findByText(
        "Interviewing splits into the rounds each application reached before it moved on: Round 1, Round 2 and so on. A round counts once it has happened, or is done.",
      ),
    ).toBeInTheDocument();
    expect(localStorage.getItem("jat.insights.rounds")).toBe("true");
  });

  it("says to restart an older server that can't expand them", async () => {
    localStorage.setItem("jat.insights.rounds", "true");
    showInsights(false);
    expect(
      await screen.findByText("Showing rounds needs the tracker to be restarted after the update."),
    ).toBeInTheDocument();
  });
});
