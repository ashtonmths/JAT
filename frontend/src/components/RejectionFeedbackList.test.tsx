import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Insights' Rejections tab: every application with rejection feedback, in these words.

const rejection = (overrides: Record<string, unknown> = {}) => ({
  application_id: "a1",
  company_id: "co1",
  company_name: "Contoso",
  role_title: "Backend Engineer",
  recruiter_id: "c1",
  recruiter_name: "Alex Recruiter",
  stage: "rejected",
  stage_name: "Rejected",
  feedback: "Wanted more Go\n\nKind about the take-home",
  rejected_at: "2026-10-03T09:00:00Z",
  rejected_from: "screen",
  rejected_from_name: "Screen",
  added_at_rejected: false,
  ...overrides,
});

async function showRejections(rejections: unknown) {
  const calls = mockApi({
    "/api/v1/workflow": WORKFLOW,
    "/api/v1/contacts": [],
    "/api/v1/health": {},
    ...(rejections === undefined ? {} : { "/api/v1/insights/rejections": rejections }),
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/insights"] }))} />);
  fireEvent.click(await screen.findByRole("tab", { name: "Rejections" }));
  return calls;
}

const item = (name: string) => screen.findByRole("listitem", { name });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the Rejections tab", () => {
  it("lists each with its rejection, the feedback as written and a link to the application", async () => {
    await showRejections([rejection()]);
    const card = await item("Contoso: Backend Engineer");
    expect(within(card).getByRole("link", { name: "Contoso · Backend Engineer" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    expect(within(card).getByRole("link", { name: "Alex Recruiter" })).toHaveAttribute("href", "/people/c1");
    expect(within(card).getByText("Rejected from Screen on 3 Oct 2026.")).toBeInTheDocument();
    expect(within(card).getByText(/Wanted more Go/).textContent).toBe(
      "Wanted more Go\n\nKind about the take-home",
    );
    expect(screen.getByText("1 application has feedback.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "What they said when they turned you down, newest first, whatever has happened since.",
      ),
    ).toBeInTheDocument();
  });

  it("says where one is now when it was reopened, undone or added straight at Rejected", async () => {
    await showRejections([
      rejection({
        application_id: "a1",
        stage: "screen",
        stage_name: "Screen",
        rejected_from: "applied",
        rejected_from_name: "Applied",
      }),
      rejection({
        application_id: "a2",
        company_name: "Litware",
        stage: "applied",
        stage_name: "Applied",
        rejected_at: null,
        rejected_from: null,
        rejected_from_name: null,
      }),
      rejection({
        application_id: "a3",
        company_name: "Fabrikam",
        recruiter_name: null,
        recruiter_id: null,
        added_at_rejected: true,
        rejected_from: "interested",
        rejected_from_name: "Interested",
      }),
    ]);
    expect(
      within(await item("Contoso: Backend Engineer")).getByText(
        "Rejected from Applied on 3 Oct 2026. It's at Screen now.",
      ),
    ).toBeInTheDocument();
    expect(
      within(await item("Litware: Backend Engineer")).getByText(
        "Its move to Rejected was undone. It's at Applied now.",
      ),
    ).toBeInTheDocument();
    const added = await item("Fabrikam: Backend Engineer");
    expect(within(added).getByText("Added as rejected on 3 Oct 2026.")).toBeInTheDocument();
    expect(within(added).queryByRole("link", { name: "Alex Recruiter" })).not.toBeInTheDocument();
    expect(screen.getByText("3 applications have feedback.")).toBeInTheDocument();
  });

  it("says when there's none, all time and in a period, which goes by the rejection date", async () => {
    const calls = await showRejections([]);
    expect(
      await screen.findByText(
        "No rejection feedback yet. When you move an application to Rejected, you can say what they told you.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Last 30 days" }));
    expect(
      await screen.findByText("No rejection feedback for applications rejected in this period."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "What they said when they turned you down, for applications rejected in this period, newest first.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.some((c) => c.path.startsWith("/api/v1/insights/rejections?since="))).toBe(true),
    );
  });

  it("says to restart an older server that doesn't have it", async () => {
    await showRejections(undefined);
    expect(
      await screen.findByText(
        "Couldn't load the rejection feedback. If you've just updated the tracker, restart it.",
      ),
    ).toBeInTheDocument();
  });
});
