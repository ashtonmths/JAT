import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { formatDateTime } from "../utils/time";
import { RoundBadge, roundStatus } from "./Interviews";
import { RescheduleButton, RescheduleModal, wasText } from "./Reschedule";

// A round that can't go ahead at its time, with no new one agreed yet: what it says, word for word.

const round = {
  id: "i1",
  round: 2,
  title: "System design test",
  kind: "system_design",
  status: "scheduled",
  starts_at: "2030-03-14T10:00:00Z",
  deadline_at: null,
  label: "Round 2 · System design test",
  company_name: "Contoso",
  role_title: "Senior Backend Engineer",
};
const waiting = {
  ...round,
  needs_new_time_since: "2030-03-10T09:00:00Z",
  needs_new_time_by: "them" as const,
};
const OLD = formatDateTime(round.starts_at);

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the Reschedule dialog, with no new time yet", () => {
  const TODO_HINT =
    "The to-do stays open until the round has its new time. Setting that, with Set new time or Edit, counts as the move from the old time and ticks the to-do off for you.";

  it("swaps the new time for a to-do to book it, added by default", async () => {
    mockApi({});
    wrap(<RescheduleModal interview={round} onClose={() => {}} />);
    expect(screen.getByLabelText("New time")).toBeInTheDocument();
    const choice = screen.getByRole("checkbox", { name: "A new time isn't agreed yet" });
    expect(
      screen.getByText("The round keeps its old time and shows as needing a new one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Add a to-do to book the new time" })).toBeNull();
    fireEvent.click(choice);
    expect(screen.queryByLabelText("New time")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Add a to-do to book the new time" })).toBeChecked();
    expect(screen.getByLabelText("To-do due")).toBeInTheDocument();
    expect(screen.getByText(TODO_HINT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save: needs a new time" })).toBeEnabled();
  });

  it("still asks who needed the change, then sends who, why and the to-do", async () => {
    // A fixed clock just before local midnight: the due date is the day the dialog opened on.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2030, 2, 11, 23, 59, 30) });
    const calls = mockApi({ "POST /api/v1/interviews/i1/needs-new-time": waiting });
    const onClose = vi.fn();
    wrap(<RescheduleModal interview={round} onClose={onClose} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "A new time isn't agreed yet" }));
    fireEvent.click(screen.getByRole("button", { name: "Save: needs a new time" }));
    expect(await screen.findByText("Choose who needed the change")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Them", hidden: true }));
    fireEvent.change(screen.getByLabelText("Why? (optional)"), {
      target: { value: " Their manager is away " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save: needs a new time" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.filter((c) => c.method === "POST")).toEqual([
      {
        method: "POST",
        path: "/api/v1/interviews/i1/needs-new-time",
        body: {
          by: "them",
          reason: "Their manager is away",
          todo: {
            text: "Book a new time for Round 2 · System design test",
            due_on: "2030-03-11",
          },
        },
      },
    ]);
  });

  it("sends no to-do when you untick it, and its Undo gives the round its old time back", async () => {
    const calls = mockApi({
      "POST /api/v1/interviews/i1/needs-new-time": waiting,
      "DELETE /api/v1/interviews/i1/needs-new-time": round,
    });
    wrap(<RescheduleModal interview={round} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "A new time isn't agreed yet" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Add a to-do to book the new time" }));
    expect(screen.queryByLabelText("To-do due")).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Me", hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save: needs a new time" }));
    const toast = (await screen.findByText("Round 2 · System design test needs a new time.")).closest(
      ".mantine-Notification-root",
    ) as HTMLElement;
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ by: "me", reason: null, todo: null });
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/interviews/i1/needs-new-time"),
      ).toBe(true),
    );
  });
});

describe("a round waiting for a new time", () => {
  it.each([
    ["me", `Was ${OLD}. You needed the change.`],
    ["them", `Was ${OLD}. They needed the change.`],
    ["mutual", `Was ${OLD}. You both needed the change.`],
    ["neither", `Was ${OLD}. Not down to either of you.`],
    [null, `Was ${OLD}.`],
  ] as const)("says its old time, and who needed the change (%s)", (by, text) => {
    expect(wasText({ starts_at: round.starts_at, needs_new_time_by: by })).toBe(text);
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

  it("still offers Set new time once its old time is cleared, with no old time to keep", async () => {
    mockApi({});
    wrap(<RescheduleButton interview={{ ...waiting, starts_at: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Set a new time for Round 2 · System design test" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Set a new time for Round 2 · System design test",
    });
    expect(within(dialog).getByText("It has no time now. They needed the change.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Keep the old time" })).toBeNull();
  });

  it("is marked so in its status and its badge on the board, list and quick view", () => {
    expect(roundStatus(waiting)).toEqual({ label: "Needs a new time", color: "red" });
    wrap(<RoundBadge round={waiting} stageKind="active" />);
    expect(screen.getByText("Round 2 · System design test · needs a new time")).toBeInTheDocument();
  });

  it("offers Set new time, or keeping the old time", async () => {
    const calls = mockApi({ "DELETE /api/v1/interviews/i1/needs-new-time": round });
    wrap(<RescheduleButton interview={waiting} />);
    expect(screen.queryByRole("button", { name: /^Reschedule/ })).toBeNull();
    const button = screen.getByRole("button", { name: "Set a new time for Round 2 · System design test" });
    expect(button).toHaveTextContent("Set new time");
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", {
      name: "Set a new time for Round 2 · System design test",
    });
    expect(within(dialog).getByText("Contoso · Senior Backend Engineer")).toBeInTheDocument();
    expect(within(dialog).getByText(`Was ${OLD}. They needed the change.`)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Setting it counts as the move from the old time, and ticks off any to-do made to book it.",
      ),
    ).toBeInTheDocument();
    // jsdom can't drive the date picker: setting the time is in e2e/reschedule-pending.spec.ts.
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep the old time" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});
