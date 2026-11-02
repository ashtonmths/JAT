import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { feedbackField } from "./RejectionFeedback";

// Rejection feedback: asked on the way to Rejected, then shown, added and edited on the application.

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...row(),
  events: [],
  contacts: [],
  allowed_next: ["screen", "rejected"],
  suggested_next: ["screen", "rejected"],
  can_undo: false,
  documents: [],
  duplicates: [],
  rejection_feedback: null,
  ...overrides,
});

function showApplication(overrides: Record<string, unknown> = {}) {
  const calls = mockApi({
    "/api/v1/workflow": WORKFLOW,
    "GET /api/v1/applications/a1": detail(overrides),
    "POST /api/v1/applications/a1/move": detail({ ...overrides, stage: "rejected", stage_kind: "closed" }),
    "PUT /api/v1/applications/a1/rejection-feedback": detail(overrides),
    "/api/v1/contacts": [],
    "/api/v1/roles": [],
    "/api/v1/documents": [],
    "/api/v1/health": {},
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/applications/a1"] }))} />);
  return calls;
}

const sent = (calls: ReturnType<typeof mockApi>, method: string, end: string) =>
  calls.find((c) => c.method === method && c.path.endsWith(end))?.body;

async function moveToRejected() {
  fireEvent.click(await screen.findByRole("button", { name: /Move to/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rejected", hidden: true }));
  return screen.findByRole("dialog", { name: "Moving to Rejected: any feedback?" });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("what a move sends", () => {
  it("sends text as written, clears what's there when emptied, and otherwise leaves the field out", () => {
    expect(feedbackField("  Wanted Go\n", null)).toEqual({ rejection_feedback: "  Wanted Go\n" });
    expect(feedbackField("New", "Old")).toEqual({ rejection_feedback: "New" });
    expect(feedbackField(" \n", "Old")).toEqual({ rejection_feedback: "" });
    expect(feedbackField("", null)).toEqual({});
    // An older server sends no feedback at all: the field stays out, so it takes the move.
    expect(feedbackField("", undefined)).toEqual({});
  });
});

describe("moving to Rejected", () => {
  it("asks first, in these words, and sends nothing until it's confirmed", async () => {
    const calls = showApplication();
    const dialog = await moveToRejected();
    expect(within(dialog).getByText("Backend Engineer at Contoso")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/What did they say\?/)).toHaveValue("");
    expect(
      within(dialog).getByText(
        "Optional: leave it empty to move it without feedback. You can add or change it later.",
      ),
    ).toBeInTheDocument();
    expect(sent(calls, "POST", "/move")).toBeUndefined();
    fireEvent.change(within(dialog).getByLabelText(/What did they say\?/), {
      target: { value: "  Wanted more Go\n" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move to Rejected" }));
    await waitFor(() =>
      expect(sent(calls, "POST", "/move")).toEqual({
        to_stage: "rejected",
        note: null,
        rejection_feedback: "  Wanted more Go\n",
      }),
    );
  });

  it("Cancel moves nothing", async () => {
    const calls = showApplication();
    const dialog = await moveToRejected();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent(calls, "POST", "/move")).toBeUndefined();
  });

  it("left empty, moves without the field", async () => {
    const calls = showApplication();
    const dialog = await moveToRejected();
    fireEvent.click(within(dialog).getByRole("button", { name: "Move to Rejected" }));
    await waitFor(() => expect(sent(calls, "POST", "/move")).toEqual({ to_stage: "rejected", note: null }));
  });

  it("opens with what's there when rejected again", async () => {
    const calls = showApplication({ rejection_feedback: "First time" });
    const dialog = await moveToRejected();
    expect(within(dialog).getByLabelText(/What did they say\?/)).toHaveValue("First time");
    fireEvent.change(within(dialog).getByLabelText(/What did they say\?/), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move to Rejected" }));
    await waitFor(() =>
      expect(sent(calls, "POST", "/move")).toEqual({
        to_stage: "rejected",
        note: null,
        rejection_feedback: "",
      }),
    );
  });

  it("another stage doesn't ask", async () => {
    const calls = showApplication();
    fireEvent.click(await screen.findByRole("button", { name: /Move to/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Screen", hidden: true }));
    await waitFor(() => expect(sent(calls, "POST", "/move")).toEqual({ to_stage: "screen", note: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("on the application", () => {
  it("isn't there for an open application that never had any", async () => {
    showApplication();
    await screen.findByRole("button", { name: /Move to/ });
    expect(screen.queryByText("Rejection feedback")).not.toBeInTheDocument();
  });

  it("says there's none yet on a rejected one, and Add feedback saves it as written", async () => {
    const calls = showApplication({ stage: "rejected", stage_kind: "closed", stage_name: "Rejected" });
    expect(await screen.findByText("Rejection feedback")).toBeInTheDocument();
    expect(screen.getByText("No feedback yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add feedback" }));
    const dialog = await screen.findByRole("dialog", { name: "Add rejection feedback" });
    fireEvent.change(within(dialog).getByLabelText(/What did they say\?/), {
      target: { value: " By phone " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save feedback" }));
    await waitFor(() =>
      expect(sent(calls, "PUT", "/rejection-feedback")).toEqual({ feedback: " By phone " }),
    );
  });

  it("shows it as written, kept after reopening, and emptying it in Edit clears it", async () => {
    const calls = showApplication({ rejection_feedback: "Line one\n\nLine two" }); // reopened: at Applied
    expect((await screen.findByTestId("rejection-feedback")).textContent).toBe("Line one\n\nLine two");
    fireEvent.click(screen.getByRole("button", { name: "Edit feedback" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit rejection feedback" });
    fireEvent.change(within(dialog).getByLabelText(/What did they say\?/), { target: { value: "  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save feedback" }));
    await waitFor(() => expect(sent(calls, "PUT", "/rejection-feedback")).toEqual({ feedback: null }));
  });
});
