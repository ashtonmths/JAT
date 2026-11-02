import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Which round rejections came after, on Insights' Rejections tab: whole sentences, plurals on the total.

const counts = (overrides: Record<string, unknown> = {}) => ({
  rejections: 6,
  no_rounds: 1,
  unnumbered: 0,
  by_kind: [
    { kind: "coding_task", count: 4 },
    { kind: "system_design", count: 1 },
  ],
  by_number: [
    { round: 1, count: 2 },
    { round: 2, count: 3 },
  ],
  ...overrides,
});

async function showRounds(rounds: unknown) {
  const calls = mockApi({
    "/api/v1/workflow": WORKFLOW,
    "/api/v1/health": {},
    "/api/v1/insights/rejections": [],
    ...(rounds === undefined ? {} : { "/api/v1/insights/rejections/rounds": rounds }),
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/insights"] }))} />);
  fireEvent.click(await screen.findByRole("tab", { name: "Rejections" }));
  return calls;
}

const lines = (name: string) =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("which round rejections came after", () => {
  it("counts by kind and by number, in whole sentences, with the hint", async () => {
    await showRounds(counts());
    expect(
      await screen.findByText("6 rejections in all. 1 of 6 rejections came before any round."),
    ).toBeInTheDocument();
    expect(lines("By kind of round")).toEqual([
      "4 of 6 rejections came after a coding task.",
      "1 of 6 rejections came after a system design round.",
    ]);
    expect(lines("By round number")).toEqual([
      "2 of 6 rejections came after round 1.",
      "3 of 6 rejections came after round 2.",
    ]);
    expect(
      screen.getByText(
        "These are plain counts, not a pattern: with only a few rejections, one more can change the picture.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Every rejection that stands, with feedback or not, by the last round it reached before you were turned down.",
      ),
    ).toBeInTheDocument();
  });

  it("says one rejection in the singular, and words a kind it doesn't know and an unnumbered round", async () => {
    await showRounds(
      counts({
        rejections: 1,
        no_rounds: 0,
        unnumbered: 1,
        by_kind: [{ kind: "panel", count: 1 }],
        by_number: [],
      }),
    );
    expect(await screen.findByText("1 rejection in all.")).toBeInTheDocument();
    expect(lines("By kind of round")).toEqual(["1 of 1 rejection came after another kind of round."]);
    expect(lines("By round number")).toEqual(["1 of 1 rejection came after a round with no number."]);
  });

  it("has a sentence for every kind of round", async () => {
    const kinds = [
      "screen",
      "hiring_manager",
      "technical",
      "pairing",
      "behavioural",
      "onsite",
      "final",
      "other",
    ];
    await showRounds(counts({ by_kind: kinds.map((kind) => ({ kind, count: 1 })) }));
    await screen.findByText(/6 rejections in all/);
    expect(lines("By kind of round")).toEqual([
      "1 of 6 rejections came after a screen.",
      "1 of 6 rejections came after a hiring manager round.",
      "1 of 6 rejections came after a technical round.",
      "1 of 6 rejections came after a pairing round.",
      "1 of 6 rejections came after a behavioural round.",
      "1 of 6 rejections came after an onsite.",
      "1 of 6 rejections came after a final round.",
      "1 of 6 rejections came after another kind of round.",
    ]);
  });

  it("says when there are none, all time and in a period", async () => {
    const calls = await showRounds(counts({ rejections: 0, no_rounds: 0, by_kind: [], by_number: [] }));
    expect(await screen.findByText("No rejections yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Last 30 days" }));
    expect(await screen.findByText("No rejections in this period.")).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.some((c) => c.path.startsWith("/api/v1/insights/rejections/rounds?since="))).toBe(true),
    );
  });

  it("says to restart an older server that doesn't have it", async () => {
    await showRounds(undefined);
    expect(
      await screen.findByText(
        "Couldn't load which round rejections came after. If you've just updated the tracker, restart it.",
      ),
    ).toBeInTheDocument();
  });
});
