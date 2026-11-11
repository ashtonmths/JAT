import dayjs from "dayjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

  it("orders by the moment, not the text: zones compare right, a date-only deadline comes first", () => {
    // 09:00 UTC is earlier than 11:00 at +01:00 (10:00 UTC), though "…T11" sorts after "…T09" as text,
    // and 08:30 at -02:00 (10:30 UTC) is later than both, though it sorts first as text.
    const plusOne = round({ id: "plusOne", starts_at: "2026-11-12T11:00:00+01:00" });
    const utc = round({ id: "utc", starts_at: "2026-11-12T09:00:00Z" });
    const minusTwo = round({ id: "minusTwo", starts_at: "2026-11-12T08:30:00-02:00" });
    const dateOnly = round({ id: "dateOnly", starts_at: null, deadline_at: "2026-11-12" });
    const order = (rs: CalendarRound[]) => [...byDay(rs).values()].flat().map((r) => r.id);
    expect(order([minusTwo, plusOne, dateOnly, utc])).toEqual(["dateOnly", "utc", "plusOne", "minusTwo"]);
  });
});

describe("periods", () => {
  it("a month is its first to its last day, a year 1 January to 31 December", () => {
    expect(periodRange("2026-02-14", "month")).toEqual({ first: "2026-02-01", last: "2026-02-28" });
    expect(periodRange("2028-02-29", "month")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(periodRange("2026-11-11", "year")).toEqual({ first: "2026-01-01", last: "2026-12-31" });
  });

  it("the month grid is whole weeks from the Monday before the 1st to the Sunday after the last", () => {
    const days = gridDays("2026-11-11");
    // 1 Nov 2026 is a Sunday, 30 Nov a Monday: six rows.
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days).toHaveLength(42);
    // February 2027 starts on a Monday and ends on a Sunday: exactly four rows.
    expect(gridDays("2027-02-10")).toHaveLength(28);
  });

  it("moves by a whole month or year, across a year's end and a leap day", () => {
    expect(shiftPeriod("2026-12-15", "month", 1)).toBe("2027-01-15");
    expect(shiftPeriod("2026-03-31", "month", -1)).toBe("2026-02-28");
    expect(shiftPeriod("2026-11-11", "year", -1)).toBe("2025-11-11");
    expect(shiftPeriod("2028-02-29", "year", 1)).toBe("2029-02-28");
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

  it("puts each status in one bucket, and leaves unknown ones and those waiting for a time out", () => {
    const one = (overrides: Partial<CalendarRound>) =>
      summarise([round({ starts_at: "2026-11-20T10:00:00", ...overrides })], "2026-11-01", "2026-11-30", NOW);
    const zero = { held: 0, comingUp: 0, awaiting: 0, cancelled: 0, rescheduled: 0, companies: 0, total: 0 };
    expect(one({})).toEqual({ ...zero, comingUp: 1, companies: 1, total: 1 });
    expect(one({ starts_at: "2026-11-10T10:00:00" })).toEqual({
      ...zero,
      awaiting: 1,
      companies: 1,
      total: 1,
    });
    expect(one({ status: "done" })).toEqual({ ...zero, held: 1, companies: 1, total: 1 });
    expect(one({ status: "cancelled" })).toEqual({ ...zero, cancelled: 1, total: 1 });
    expect(one({ needs_new_time_since: "2026-11-09T10:00:00" })).toEqual(zero);
    // Not a status the API has today (InterviewIn: scheduled, done, cancelled); a newer server's
    // stays off the calendar rather than landing in a guessed bucket.
    expect(one({ status: "no_show" })).toEqual(zero);
    expect(byDay([round({ status: "no_show" })]).size).toBe(0);
  });

  it("counts a moved round as rescheduled unless it was then cancelled", () => {
    const moved = { rescheduled_count: 1, starts_at: "2026-11-20T10:00:00" };
    const s = summarise(
      [round({ ...moved, id: "a" }), round({ ...moved, id: "b", status: "cancelled" })],
      "2026-11-01",
      "2026-11-30",
      NOW,
    );
    expect(s.rescheduled).toBe(1);
    expect(s.cancelled).toBe(1);
  });

  it("is all zeros for an empty period", () => {
    const s = summarise(rounds, "2026-08-01", "2026-08-31", NOW);
    expect(s.total).toBe(0);
    expect(s.companies).toBe(0);
  });
});

describe("in Europe/London, across the clock changes", () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/London";
  });
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  it("runs in that zone", () => {
    expect(new Date("2026-07-01T12:00:00Z").getHours()).toBe(13);
    expect(new Date("2026-12-01T12:00:00Z").getHours()).toBe(12);
  });

  it("the months with a clock change are whole weeks, each day once, Monday to Sunday", () => {
    for (const month of ["2026-03-10", "2026-10-10"]) {
      const days = gridDays(month);
      expect(new Set(days).size).toBe(days.length);
      expect(days.length % 7).toBe(0);
      expect(dayjs(days[0]).day()).toBe(1);
    }
    // March 2026 starts on a Sunday. The change is on Sunday the 29th, ending a row; the last row follows.
    expect(gridDays("2026-03-10")[0]).toBe("2026-02-23");
    expect(gridDays("2026-03-10").slice(-8)).toEqual([
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);
    expect(gridDays("2026-10-10")).toHaveLength(35);
    expect(shiftPeriod("2026-03-26", "month", 1)).toBe("2026-04-26");
    expect(shiftPeriod("2026-10-29", "month", -1)).toBe("2026-09-29");
  });

  it("puts a round late at night on the local day, in summer and winter time", () => {
    const at = (iso: string) => roundDay(round({ starts_at: iso }));
    expect(at("2026-03-29T00:30:00Z")).toBe("2026-03-29"); // 00:30 GMT, before the change
    expect(at("2026-03-29T23:30:00Z")).toBe("2026-03-30"); // 00:30 BST the next day
    expect(at("2026-10-24T23:30:00Z")).toBe("2026-10-25"); // 00:30 BST on the day it ends
    expect(at("2026-10-25T23:30:00Z")).toBe("2026-10-25"); // 23:30 GMT
    // 23:30 BST on 31 Mar is in March; 23:30 UTC that day is 1 April where you are.
    const march = periodRange("2026-03-29", "month");
    const s = summarise(
      [round({ starts_at: "2026-03-31T22:30:00Z" }), round({ starts_at: "2026-03-31T23:30:00Z" })],
      march.first,
      march.last,
      NOW,
    );
    expect(s.total).toBe(1);
  });
});
