import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { formatDay } from "../utils/format";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

/** The Interviews page as a list (the calendar is the first choice). */
function renderList() {
  localStorage.setItem("jat.interviews.view", JSON.stringify("list"));
  renderAt("/interviews");
}

const round2 = {
  id: "i2",
  round: 2,
  title: "Engineering manager chat",
  kind: "hiring_manager",
  status: "scheduled",
  label: "Round 2 · Engineering manager chat",
  starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), // in two days
  deadline_at: null,
};
const interview = (overrides: Record<string, unknown> = {}) => ({
  ...round2,
  application_id: "a1",
  ends_at: null,
  format: "video",
  location: null,
  meeting_url: "https://meet.example.com/abc",
  prep: null,
  debrief: null,
  questions: null,
  task_instructions: null,
  task_repo_url: null,
  interviewer_ids: ["c1"],
  company_name: "Contoso",
  role_title: "Backend Engineer",
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
  ...overrides,
});
const screenRound = interview({
  id: "i1",
  round: 1,
  title: "Recruiter screen",
  kind: "screen",
  status: "done",
  label: "Round 1 · Recruiter screen",
  starts_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  debrief: "Friendly, salary range confirmed.",
});
const detail = {
  ...row({ stage: "interviewing", stage_name: "Interviewing", current_round: round2 }),
  events: [],
  contacts: [],
  allowed_next: [],
  suggested_next: [],
  can_undo: false,
  documents: [],
  duplicates: [],
};
const contacts = [
  {
    id: "c1",
    name: "Riley Chen",
    title: null,
    agency_id: null,
    company_id: "co1",
    details: [],
    created_at: "",
    updated_at: "",
  },
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("interviews", () => {
  it("says when each round is and who with, in whole sentences", async () => {
    const at = "2030-10-02T13:00:00";
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/interviews": [
        interview({ id: "w1", round: 1, starts_at: at }),
        interview({ id: "w2", round: 2, starts_at: at, interviewer_ids: [] }),
        interview({ id: "w3", round: 3, starts_at: null, deadline_at: at }),
        interview({ id: "w4", round: 4, starts_at: null, deadline_at: at, interviewer_ids: [] }),
        interview({ id: "w5", round: 5, starts_at: null }),
        interview({ id: "w6", round: 6, starts_at: null, interviewer_ids: [] }),
      ],
      "/api/v1/contacts": contacts,
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Interviews" })).closest(".mantine-Card-root")!;
    const has = (text: string) => within(card as HTMLElement).findByText(text);
    await has("2 Oct 2030, 13:00 · with Riley Chen");
    await has("2 Oct 2030, 13:00");
    await has("Due 2 Oct 2030, 13:00 · with Riley Chen");
    await has("Due 2 Oct 2030, 13:00");
    await has("Not booked yet · with Riley Chen");
    await has("Not booked yet");
  });

  it("lists an application's rounds and adds the next one", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/interviews": [interview(), screenRound],
      "/api/v1/interviews/titles": ["System design test", "Recruiter screen"],
      "POST /api/v1/applications/a1/interviews": interview({ id: "i3", round: 3 }),
      "/api/v1/contacts": contacts,
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Interviews" })).closest(".mantine-Card-root")!;
    const items = await within(card as HTMLElement).findAllByText(/^Round \d · /);
    expect(items.map((i) => i.textContent)).toEqual([
      "Round 1 · Recruiter screen",
      "Round 2 · Engineering manager chat",
    ]);
    expect(within(card as HTMLElement).getAllByText(/with Riley Chen/)).toHaveLength(2);
    expect(within(card as HTMLElement).getByText("Friendly, salary range confirmed.")).toBeInTheDocument();
    // The header shows where the application is up to, with the date of the next round.
    expect(screen.getByText(/^Round 2 · Engineering manager chat · \w+/)).toBeInTheDocument();

    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Add round 3" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Round")).toHaveValue("3");
    fireEvent.change(within(dialog).getByLabelText("What is it?"), {
      target: { value: "System design test" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add round" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications/a1/interviews");
      expect(post?.body).toMatchObject({
        round: 3,
        title: "System design test",
        kind: "technical",
        status: "scheduled",
        interviewer_ids: [],
      });
    });
  });

  it("shows the current round in the applications list", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [
        row({ stage: "interviewing", stage_name: "Interviewing", current_round: round2 }),
        // After an offer the last round is history: no badge.
        row({
          id: "a2",
          company_name: "Fabrikam",
          stage: "offer",
          stage_name: "Offer",
          stage_kind: "success",
          current_round: {
            ...round2,
            id: "i9",
            round: 3,
            title: "Final",
            label: "Round 3 · Final",
            status: "done",
          },
        }),
      ],
      "/api/v1/health": {},
    });
    renderAt("/applications");
    expect(await screen.findByText(/^Round 2 · Engineering manager chat · /)).toBeInTheDocument();
    expect(screen.getByText("Fabrikam")).toBeInTheDocument();
    expect(screen.queryByText(/Round 3 · Final/)).not.toBeInTheDocument();
  });

  it("marks a past round that's still scheduled as awaiting outcome", async () => {
    const past = interview({ starts_at: new Date(Date.now() - 86_400_000).toISOString() });
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) => (url.searchParams.get("upcoming") ? [] : [past]),
      "/api/v1/health": {},
    });
    renderList();
    expect(await screen.findByText("Awaiting outcome")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing booked. Add interview rounds from an application's page."),
    ).toBeInTheDocument();
  });

  it("lists upcoming and earlier interviews across applications", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) =>
        url.searchParams.get("upcoming") ? [interview()] : [screenRound, interview()],
      "/api/v1/health": {},
    });
    renderList();
    const upcoming = (await screen.findByRole("heading", { name: "Coming up" })).closest(
      ".mantine-Card-root",
    )!;
    expect(
      await within(upcoming as HTMLElement).findByText("Round 2 · Engineering manager chat"),
    ).toBeInTheDocument();
    expect(within(upcoming as HTMLElement).getByRole("link", { name: "Contoso" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    const earlier = screen
      .getByRole("heading", { name: "Earlier and cancelled" })
      .closest(".mantine-Card-root")!;
    expect(await within(earlier as HTMLElement).findByText("Round 1 · Recruiter screen")).toBeInTheDocument();
  });

  it("edits a round, or reschedules a booked one, from the list", async () => {
    const moved = interview({ rescheduled_count: 2, rescheduled_from: "2026-10-20T14:00:00Z" });
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) => (url.searchParams.get("upcoming") ? [moved] : [screenRound, moved]),
      "/api/v1/interviews/titles": [],
      "/api/v1/contacts": contacts,
      "/api/v1/health": {},
    });
    renderList();
    const upcoming = (await screen.findByRole("heading", { name: "Coming up" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    // Marked as moved, twice.
    expect(await within(upcoming).findByText("Rescheduled ×2")).toBeInTheDocument();
    // A done round can be edited but not rescheduled.
    expect(screen.queryByRole("button", { name: "Reschedule Round 1 · Recruiter screen" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Round 1 · Recruiter screen" })).toBeInTheDocument();

    // Reschedule asks for the new time; it can't be saved until the time changes.
    fireEvent.click(
      within(upcoming).getByRole("button", { name: "Reschedule Round 2 · Engineering manager chat" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Reschedule Round 2 · Engineering manager chat",
    });
    expect(within(dialog).getByLabelText("Why? (optional)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reschedule" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    // Edit opens the round's full form.
    fireEvent.click(
      within(upcoming).getByRole("button", { name: "Edit Round 2 · Engineering manager chat" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Edit Round 2 · Engineering manager chat" }),
    ).toBeInTheDocument();
  });
});

describe("the interviews calendar", () => {
  // Rounds early and late today, so they're on this month's calendar whenever the test runs.
  const today = dayjs().format("YYYY-MM-DD");
  const held = interview({ ...screenRound, starts_at: dayjs(`${today}T00:05:00`).toISOString() });
  const later = interview({ starts_at: dayjs(`${today}T23:55:00`).toISOString(), rescheduled_count: 1 });
  const unbooked = interview({
    id: "i9",
    round: 3,
    title: "Final",
    label: "Round 3 · Final",
    starts_at: null,
  });

  function mock() {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) =>
        url.searchParams.get("upcoming") ? [later] : [held, later, unbooked],
      "/api/v1/interviews/titles": [],
      "/api/v1/contacts": contacts,
      "/api/v1/health": {},
    });
  }

  it("is the first view: rounds on today, the month's figures, and those still to book under it", async () => {
    mock();
    renderAt("/interviews");
    expect(
      await screen.findByRole("heading", { name: formatDay(today, "monthNameYear", "en") }),
    ).toBeInTheDocument();
    const cell = document.querySelector(`[data-day="${today}"]`) as HTMLElement;
    expect(
      within(cell).getByRole("button", { name: "Round 1 · Recruiter screen, Contoso, 00:05" }),
    ).toBeInTheDocument();
    expect(
      within(cell).getByRole("button", { name: "Round 2 · Engineering manager chat, Contoso, 23:55" }),
    ).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: /^Summary for / });
    const stat = (id: string) => summary.querySelector(`[data-stat="${id}"]`)?.textContent;
    expect(stat("held")).toBe("1held");
    expect(stat("comingUp")).toBe("1coming up");
    expect(stat("rescheduled")).toBe("1rescheduled");
    expect(stat("companies")).toBe("1company");

    const toBook = screen
      .getByRole("heading", { name: "Still to book" })
      .closest(".mantine-Card-root") as HTMLElement;
    expect(within(toBook).getByText("Round 3 · Final")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coming up" })).toBeNull();
  });

  it("shows a round's details when clicked, with its actions and a link to the application", async () => {
    mock();
    renderAt("/interviews");
    fireEvent.click(
      await screen.findByRole("button", { name: /^Round 2 · Engineering manager chat, Contoso/ }),
    );
    // jsdom has no layout, so Mantine takes the chip for scrolled away and hides the card (hideDetached):
    // look for its contents hidden too. The browser test checks it shows (e2e/interviews-calendar.spec.ts).
    const hidden = { hidden: true };
    const open = await screen.findByRole("link", { name: "Open the application", ...hidden });
    expect(open).toHaveAttribute("href", "/applications/a1");
    expect(screen.getByText("With Riley Chen")).toBeInTheDocument();
    expect(screen.getByText("Video call")).toBeInTheDocument();
    for (const name of ["Reschedule", "Edit"]) {
      const button = screen.getByRole("button", {
        name: `${name} Round 2 · Engineering manager chat`,
        ...hidden,
      });
      expect(button).toBeInTheDocument();
    }
  });

  it("switches to the list and remembers it", async () => {
    mock();
    renderAt("/interviews");
    fireEvent.click(await screen.findByText("List"));
    expect(await screen.findByRole("heading", { name: "Coming up" })).toBeInTheDocument();
    expect(localStorage.getItem("jat.interviews.view")).toBe(JSON.stringify("list"));
  });
});
