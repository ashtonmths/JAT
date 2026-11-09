import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDateTime } from "../utils/time";
import { RoundBadge, roundBadgeText, roundStatus } from "./Interviews";
import { wasText } from "./Reschedule";

// How a round waiting for a new time shows wherever rounds show, word for word.

const waiting = {
  id: "i1",
  round: 2,
  title: "System design test",
  kind: "system_design",
  status: "scheduled",
  starts_at: "2030-03-14T10:00:00Z",
  deadline_at: null,
  label: "Round 2 · System design test",
  needs_new_time_since: "2030-03-10T09:00:00Z",
  needs_new_time_by: "them" as const,
};
const OLD = formatDateTime(waiting.starts_at);

describe("a round waiting for a new time", () => {
  it.each([
    ["me", `Was ${OLD}. You needed the change.`],
    ["them", `Was ${OLD}. They needed the change.`],
    ["mutual", `Was ${OLD}. You both needed the change.`],
    ["neither", `Was ${OLD}. Not down to either of you.`],
    [null, `Was ${OLD}.`],
  ] as const)("says its old time, and who needed the change (%s)", (by, text) => {
    expect(wasText({ starts_at: waiting.starts_at, needs_new_time_by: by })).toBe(text);
  });

  it.each([
    ["me", "It has no time now. You needed the change."],
    ["them", "It has no time now. They needed the change."],
    ["mutual", "It has no time now. You both needed the change."],
    ["neither", "It has no time now. Not down to either of you."],
    [null, "It has no time now."],
  ] as const)("says so in a whole sentence once its old time is cleared (%s)", (by, text) => {
    expect(wasText({ starts_at: null, needs_new_time_by: by })).toBe(text);
  });

  it("is marked so in its status and its badge on the board, list and quick view", () => {
    expect(roundStatus(waiting)).toEqual({ label: "Needs a new time", color: "red" });
    render(
      <MantineProvider>
        <RoundBadge round={waiting} stageKind="active" />
      </MantineProvider>,
    );
    expect(screen.getByText("Round 2 · System design test · needs a new time")).toBeInTheDocument();
  });
});

// What the round badge on the board, list and quick view says after the round's name.
describe("the round badge", () => {
  const round = { ...waiting, needs_new_time_since: null, needs_new_time_by: null };

  it("gives a booked round's day, even once it has passed until it's marked done", () => {
    expect(roundBadgeText({ ...round, starts_at: "2030-03-14T10:00:00Z" })).toBe(
      "Round 2 · System design test · Thu 14 Mar",
    );
    expect(roundBadgeText({ ...round, starts_at: "2020-03-14T10:00:00Z" })).toBe(
      "Round 2 · System design test · Sat 14 Mar",
    );
    expect(roundBadgeText({ ...round, starts_at: null, deadline_at: "2030-03-15T17:00:00Z" })).toBe(
      "Round 2 · System design test · Fri 15 Mar",
    );
  });

  it("says a round with no time or deadline is not booked yet", () => {
    expect(roundBadgeText({ ...round, starts_at: null })).toBe(
      "Round 2 · System design test · not booked yet",
    );
  });

  it("says a done round with nothing heard since is waiting to hear back", () => {
    const done = { ...round, status: "done", waiting_to_hear_back: true };
    expect(roundBadgeText(done)).toBe("Round 2 · System design test · waiting to hear back");
    // Undated (marked done without ever being booked) too.
    expect(roundBadgeText({ ...done, starts_at: null })).toBe(
      "Round 2 · System design test · waiting to hear back",
    );
  });

  it("gives only the name of a done round with something since, or from an older server", () => {
    expect(roundBadgeText({ ...round, status: "done", waiting_to_hear_back: false })).toBe(
      "Round 2 · System design test",
    );
    expect(roundBadgeText({ ...round, status: "done" })).toBe("Round 2 · System design test");
  });

  it("still says a round waiting for a new time needs one, whatever its time", () => {
    expect(roundBadgeText({ ...waiting, starts_at: null })).toBe(
      "Round 2 · System design test · needs a new time",
    );
  });
});
