import { focusManager } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

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
      const post = calls.find(
        (c) => c.method === "POST" && c.path.startsWith("/api/v1/applications/a1/interviews?"),
      );
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
  // A fixed day, Wednesday 12 June 2030, so the rounds and the labels are the same whenever this runs.
  const today = "2030-06-12";
  const at = (day: string, time: string) => dayjs(`${day}T${time}`).toISOString();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2030, 5, 12, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  const held = interview({ ...screenRound, starts_at: at(today, "09:00") });
  const later = interview({ starts_at: at(today, "15:00"), rescheduled_count: 1 });
  const unbooked = interview({
    id: "i9",
    round: 3,
    title: "Final",
    label: "Round 3 · Final",
    starts_at: null,
  });
  // Another day this month, for choosing a day.
  const elsewhere = interview({
    id: "i7",
    round: 1,
    title: "Intro call",
    label: "Round 1 · Intro call",
    company_name: "Fabrikam",
    status: "done",
    starts_at: at("2030-06-20", "11:00"),
  });

  function mock() {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) =>
        url.searchParams.get("upcoming") ? [later] : [held, later, unbooked, elsewhere],
      "/api/v1/interviews/titles": [],
      "/api/v1/contacts": contacts,
      "/api/v1/health": {},
    });
  }
  const panel = () => screen.getByRole("region", { name: "Rounds on the chosen day" });

  it("is the first view: a month of dots, the month's figures, today's rounds beside, and those still to book", async () => {
    mock();
    renderAt("/interviews");
    expect(await screen.findByRole("heading", { name: "June 2030" })).toBeInTheDocument();
    // The dot says in words what its colour and size show, and that it's today.
    const dot = screen.getByRole("button", {
      name: "Wednesday 12 June, today: 2 rounds, 1 coming up, 1 held",
    });
    expect(dot).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Thursday 20 June: 1 round, 1 held" })).toBeInTheDocument();
    expect(within(panel()).getByText("Wednesday 12 June")).toBeInTheDocument();
    expect(within(panel()).getByText("Round 1 · Recruiter screen")).toBeInTheDocument();
    expect(within(panel()).getByText("Round 2 · Engineering manager chat")).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Summary for June 2030" });
    const stat = (id: string) => summary.querySelector(`[data-stat="${id}"]`)?.textContent;
    expect(stat("held")).toBe("2held");
    expect(stat("comingUp")).toBe("1coming up");
    expect(stat("rescheduled")).toBe("1rescheduled");
    expect(stat("companies")).toBe("2companies");

    const toBook = screen
      .getByRole("heading", { name: "Still to book" })
      .closest(".mantine-Card-root") as HTMLElement;
    expect(within(toBook).getByText("Round 3 · Final")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Coming up" })).toBeNull();
  });

  it("lists the day you choose beside, moves focus there, and each round has its actions", async () => {
    mock();
    renderAt("/interviews");
    fireEvent.click(await screen.findByRole("button", { name: "Thursday 20 June: 1 round, 1 held" }));
    const heading = within(panel()).getByRole("heading", { name: "Thursday 20 June" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(within(panel()).getByText("Round 1 · Intro call")).toBeInTheDocument();
    expect(within(panel()).queryByText("Round 2 · Engineering manager chat")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Wednesday 12 June, today: / }));
    const card = within(panel())
      .getByText("Round 2 · Engineering manager chat")
      .closest("[data-round]") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Open the application" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    expect(within(card).getByText("With Riley Chen")).toBeInTheDocument();
    expect(within(card).getByText("Video call")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Reschedule Round 2 · Engineering manager chat" }),
    ).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Edit Round 2 · Engineering manager chat" }));
    expect(
      await screen.findByRole("dialog", { name: "Edit Round 2 · Engineering manager chat" }),
    ).toBeInTheDocument();
  });

  it("gives focus back to the panel's heading when a round leaves the chosen day", async () => {
    let all = [held, later, unbooked, elsewhere];
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) => (url.searchParams.get("upcoming") ? [later] : all),
      "/api/v1/interviews/titles": [],
      "/api/v1/contacts": contacts,
      "/api/v1/health": {},
    });
    renderAt("/interviews");
    const edit = await screen.findByRole("button", { name: "Edit Round 2 · Engineering manager chat" });
    edit.focus();
    expect(edit).toHaveFocus();
    // The round moves to the 20th (as Reschedule would), and the page fetches the rounds again.
    all = [held, { ...later, starts_at: at("2030-06-20", "15:00") }, unbooked, elsewhere];
    vi.setSystemTime(new Date(2030, 5, 12, 10, 1)); // past the app's 10 s staleTime
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await waitFor(() => expect(within(panel()).queryByText("Round 2 · Engineering manager chat")).toBeNull());
    await waitFor(() =>
      expect(within(panel()).getByRole("heading", { name: "Wednesday 12 June" })).toHaveFocus(),
    );
  });

  it("shows the whole year as twelve months, with the year's figures against the year before", async () => {
    mock();
    renderAt("/interviews");
    fireEvent.click(await screen.findByText("Year"));
    expect(await screen.findByRole("heading", { name: "2030" })).toBeInTheDocument();
    for (const month of ["January 2030", "June 2030", "December 2030"])
      expect(screen.getByRole("region", { name: month })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Summary for 2030" });
    expect(summary.querySelector('[data-stat="held"]')?.textContent).toBe("2held");
    expect(within(summary).getByText("3 more rounds than 2029")).toBeInTheDocument();
    // June's small figures: held and coming up (not awaiting), and companies, in words on hover.
    const june = screen.getByRole("region", { name: "June 2030" });
    expect(within(june).getByRole("img", { name: "2 held" })).toBeInTheDocument();
    expect(within(june).getByRole("img", { name: "0 awaiting outcome" })).toBeInTheDocument();
    expect(within(june).getByRole("img", { name: "1 coming up" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    expect(await screen.findByRole("heading", { name: "2029" })).toBeInTheDocument();
    expect(screen.getByText("No rounds this year.")).toBeInTheDocument();
    // Today comes back to this year and today.
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(await screen.findByRole("heading", { name: "2030" })).toBeInTheDocument();
    expect(within(panel()).getByText("Wednesday 12 June")).toBeInTheDocument();
  });

  it("from a year back to a month, opens the chosen day's month", async () => {
    mock();
    renderAt("/interviews");
    fireEvent.click(await screen.findByText("Year"));
    fireEvent.click(await screen.findByRole("button", { name: "Thursday 20 June: 1 round, 1 held" }));
    fireEvent.click(screen.getByRole("button", { name: "Next year" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    fireEvent.click(screen.getByText("Month"));
    expect(await screen.findByRole("heading", { name: "June 2030" })).toBeInTheDocument();
  });

  it("remembers Month, Year and List, and opens the calendar for anything else stored", async () => {
    localStorage.setItem("jat.interviews.period", JSON.stringify("year"));
    mock();
    renderAt("/interviews");
    expect(await screen.findByRole("heading", { name: "2030" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Month"));
    expect(localStorage.getItem("jat.interviews.period")).toBe(JSON.stringify("month"));
    fireEvent.click(screen.getByText("List"));
    expect(await screen.findByRole("heading", { name: "Coming up" })).toBeInTheDocument();
    expect(localStorage.getItem("jat.interviews.view")).toBe(JSON.stringify("list"));
  });

  it("opens the calendar, as a month, when what's stored isn't a choice it knows", async () => {
    localStorage.setItem("jat.interviews.view", JSON.stringify("agenda"));
    localStorage.setItem("jat.interviews.period", JSON.stringify("week"));
    mock();
    renderAt("/interviews");
    expect(await screen.findByRole("heading", { name: "June 2030" })).toBeInTheDocument();
  });
});
