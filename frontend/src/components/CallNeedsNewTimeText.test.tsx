import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Meeting } from "../api/meetingHooks";
import { meeting, mockApi } from "../test/mockApi";
import { formatDateTime } from "../utils/time";
import { CallRescheduleButton } from "./CallReschedule";

// A call that can't go ahead at its time, with no new one agreed yet: what it says, word for word,
// and never "round".

const call = meeting({ starts_at: "2030-03-14T10:00:00Z" }) as Meeting;
const waiting = {
  ...call,
  needs_new_time_since: "2030-03-10T09:00:00Z",
  needs_new_time_by: "them",
} as Meeting;
const LABEL = "Call with Alex Morgan: Market catch-up";
const OLD = formatDateTime(call.starts_at);

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

describe("a call's Reschedule dialog, with no new time yet", () => {
  it("says the call keeps its time, then sends who, why and the to-do in one request", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2030, 2, 11, 12, 0, 0) });
    const calls = mockApi({
      "POST /api/v1/meetings/m1/needs-new-time": waiting,
      "DELETE /api/v1/meetings/m1/needs-new-time": call,
    });
    wrap(<CallRescheduleButton meeting={call} />);
    fireEvent.click(screen.getByRole("button", { name: `Reschedule ${LABEL}` }));
    const dialog = await screen.findByRole("dialog", { name: `Reschedule ${LABEL}` });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "A new time isn't agreed yet" }));
    expect(
      within(dialog).getByText("The call keeps its old time and shows as needing a new one."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("New time")).toBeNull();
    expect(within(dialog).getByRole("checkbox", { name: "Add a to-do to book the new time" })).toBeChecked();
    expect(
      within(dialog).getByText(
        "The to-do stays open until the call has its new time. Setting that, with Set new time or Edit, counts as the move from the old time and ticks the to-do off for you.",
      ),
    ).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/round/i);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save: needs a new time" }));
    expect(await within(dialog).findByText("Choose who needed the change")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Them", hidden: true }));
    fireEvent.change(within(dialog).getByLabelText("Why? (optional)"), { target: { value: " A clash " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save: needs a new time" }));
    const toast = (await screen.findByText(`${LABEL} needs a new time.`)).closest(
      ".mantine-Notification-root",
    ) as HTMLElement;
    // The to-do is made in the same request (a later change would stop Undo deleting it).
    expect(calls.filter((c) => c.method !== "GET")).toEqual([
      {
        method: "POST",
        path: "/api/v1/meetings/m1/needs-new-time",
        body: {
          by: "them",
          reason: "A clash",
          todo: { text: `Book a new time for ${LABEL}`, due_on: "2030-03-11" },
        },
      },
    ]);
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/meetings/m1/needs-new-time"),
      ).toBe(true),
    );
  });
});

describe("a call waiting for a new time", () => {
  it("offers Set new time, with its old time and who, or keeping the old time", async () => {
    const calls = mockApi({ "DELETE /api/v1/meetings/m1/needs-new-time": call });
    wrap(<CallRescheduleButton meeting={waiting} />);
    expect(screen.queryByRole("button", { name: /^Reschedule/ })).toBeNull();
    const button = screen.getByRole("button", { name: `Set a new time for ${LABEL}` });
    expect(button).toHaveTextContent("Set new time");
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: `Set a new time for ${LABEL}` });
    expect(within(dialog).getByText(`Was ${OLD}. They needed the change.`)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled(); // no new time yet
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep the old time" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });
});
