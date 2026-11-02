import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDateTime } from "../utils/time";
import { RoundBadge, roundStatus } from "./Interviews";
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
