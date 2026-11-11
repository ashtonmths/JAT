import { describe, expect, it } from "vitest";

import {
  activeRounds,
  byDay,
  gridDays,
  periodRange,
  roundDay,
  shiftPeriod,
  summarise,
  toBook,
  type CalendarRound,
} from "./calendar";

// Times without a zone are local, so these read the same wherever the tests run.
const round = (overrides: Partial<CalendarRound> = {}): CalendarRound => ({
  id: "r",
  status: "scheduled",
  starts_at: "2026-11-12T14:00:00",
  deadline_at: null,
  needs_new_time_since: null,
  rescheduled_count: 0,
  company_name: "Contoso",
  ...overrides,
});
const NOW = new Date("2026-11-11T09:00:00").getTime();

describe("which day a round is on", () => {
  it("is its time's local day, else its deadline's", () => {
    expect(roundDay(round())).toBe("2026-11-12");
    expect(roundDay(round({ starts_at: null, deadline_at: "2026-11-20T23:59:00" }))).toBe("2026-11-20");
  });

  it("is none for a round not booked or waiting for a new time; those are to book", () => {
    const unbooked = round({ id: "u", starts_at: null });
    const moving = round({ id: "m", needs_new_time_since: "2026-11-10T10:00:00" });
    const doneNoTime = round({ id: "d", starts_at: null, status: "done" });
    expect(roundDay(unbooked)).toBeNull();
    expect(roundDay(moving)).toBeNull();
    expect(toBook([round(), unbooked, moving, doneNoTime]).map((r) => r.id)).toEqual(["u", "m"]);
  });

  it("groups rounds by day in time order", () => {
    const late = round({ id: "late", starts_at: "2026-11-12T16:00:00" });
    const early = round({ id: "early", starts_at: "2026-11-12T09:30:00" });
    const other = round({ id: "other", starts_at: "2026-11-13T09:00:00" });
    const days = byDay([late, other, early, round({ id: "x", starts_at: null })]);
    expect([...days.keys()]).toEqual(["2026-11-12", "2026-11-13"]);
    expect(days.get("2026-11-12")!.map((r) => r.id)).toEqual(["early", "late"]);
  });
});

describe("periods", () => {
  it("a week runs Monday to Sunday, also from a Sunday", () => {
    expect(periodRange("2026-11-11", "week")).toEqual({ first: "2026-11-09", last: "2026-11-15" });
    expect(periodRange("2026-11-15", "week")).toEqual({ first: "2026-11-09", last: "2026-11-15" });
  });

  it("a month is its first to its last day", () => {
    expect(periodRange("2026-02-14", "month")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
  });

  it("the month grid is whole weeks from the Monday before the 1st to the Sunday after the last", () => {
    const days = gridDays("2026-11-11", "month");
    // 1 Nov 2026 is a Sunday, 30 Nov a Monday: six rows.
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days).toHaveLength(42);
    // February 2027 starts on a Monday and ends on a Sunday: exactly four rows.
    expect(gridDays("2027-02-10", "month")).toHaveLength(28);
    expect(gridDays("2026-11-11", "week")).toHaveLength(7);
  });

  it("moves by a whole period, across a year", () => {
    expect(shiftPeriod("2026-12-15", "month", 1)).toBe("2027-01-15");
    expect(shiftPeriod("2026-03-31", "month", -1)).toBe("2026-02-28");
    expect(shiftPeriod("2026-12-30", "week", 1)).toBe("2027-01-06");
  });
});

describe("a period's summary", () => {
  const rounds = [
    round({ id: "held", status: "done", starts_at: "2026-11-02T10:00:00", company_name: "Contoso" }),
    round({ id: "soon", starts_at: "2026-11-20T10:00:00", company_name: "Fabrikam", rescheduled_count: 2 }),
    round({ id: "waiting", starts_at: "2026-11-10T10:00:00", company_name: "Contoso" }),
    round({ id: "off", status: "cancelled", starts_at: "2026-11-05T10:00:00", company_name: "Northwind" }),
    round({ id: "due", starts_at: null, deadline_at: "2026-11-30T23:00:00", company_name: "Tailspin" }),
    // Outside November, not booked, or waiting for a new time: not counted.
    round({ id: "october", status: "done", starts_at: "2026-10-31T23:30:00" }),
    round({ id: "december", starts_at: "2026-12-01T00:30:00" }),
    round({ id: "unbooked", starts_at: null }),
    round({ id: "moving", needs_new_time_since: "2026-11-09T10:00:00", starts_at: "2026-11-12T10:00:00" }),
  ];

  it("counts held, coming up, awaiting, cancelled, rescheduled and companies", () => {
    const s = summarise(rounds, "2026-11-01", "2026-11-30", NOW);
    expect(s).toEqual({
      held: 1,
      comingUp: 2,
      awaiting: 1,
      cancelled: 1,
      rescheduled: 1,
      // Contoso twice, Fabrikam, Tailspin; Northwind's only round was cancelled.
      companies: 3,
      total: 5,
    });
    expect(activeRounds(s)).toBe(4);
  });

  it("is all zeros for an empty period", () => {
    const s = summarise(rounds, "2026-08-01", "2026-08-31", NOW);
    expect(s.total).toBe(0);
    expect(s.companies).toBe(0);
  });
});
