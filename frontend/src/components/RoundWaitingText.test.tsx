import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDateTime } from "../utils/time";
import { RoundBadge, roundBadge, roundStatus } from "./Interviews";
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
    // The round on its own badge, and what it needs on a second one beside it.
    expect(screen.getByText("Round 2 · System design test")).toBeInTheDocument();
    expect(screen.getByText("Needs a new time")).toBeInTheDocument();
  });
});

// The round badge on the board, list and quick view: the round in violet (with its day once booked),
// and, while it's in between (waiting for a time or an answer), a pink badge of its own beside it.
describe("the round badge", () => {
  const round = { ...waiting, needs_new_time_since: null, needs_new_time_by: null };
  const NAME = "Round 2 · System design test";
  const inBetween = (id: string, text: string) => ({
    text: NAME,
    color: "violet",
    state: { id, text, color: "pink" },
  });

  it("gives a booked round's day, even once it has passed until it's marked done", () => {
    expect(roundBadge({ ...round, starts_at: "2030-03-14T10:00:00Z" })).toEqual({
      text: `${NAME} · Thu 14 Mar`,
      color: "violet",
      state: null,
    });
    expect(roundBadge({ ...round, starts_at: "2020-03-14T10:00:00Z" })).toEqual({
      text: `${NAME} · Sat 14 Mar`,
      color: "violet",
      state: null,
    });
    expect(roundBadge({ ...round, starts_at: null, deadline_at: "2030-03-15T17:00:00Z" })).toEqual({
      text: `${NAME} · Fri 15 Mar`,
      color: "violet",
      state: null,
    });
  });

  it("says a round with no time or deadline is not booked yet", () => {
    expect(roundBadge({ ...round, starts_at: null })).toEqual(inBetween("notBooked", "Not booked yet"));
  });

  it("says a done round with nothing heard since is waiting to hear back", () => {
    const done = { ...round, status: "done", waiting_to_hear_back: true };
    const expected = inBetween("waiting", "Waiting to hear back");
    expect(roundBadge(done)).toEqual(expected);
    // Undated (marked done without ever being booked) too.
    expect(roundBadge({ ...done, starts_at: null })).toEqual(expected);
  });

  it("gives only the name of a done round with something since, or from an older server", () => {
    const decided = { text: NAME, color: "violet", state: null };
    expect(roundBadge({ ...round, status: "done", waiting_to_hear_back: false })).toEqual(decided);
    expect(roundBadge({ ...round, status: "done" })).toEqual(decided);
  });

  it("says a round waiting for a new time needs one, without its old day", () => {
    const expected = inBetween("needsNewTime", "Needs a new time");
    expect(roundBadge(waiting)).toEqual(expected);
    expect(roundBadge({ ...waiting, starts_at: null })).toEqual(expected);
  });
});
