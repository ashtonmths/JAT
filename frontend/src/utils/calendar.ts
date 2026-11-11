// The Interviews calendar's sums (docs/rfc/interviews-calendar.md): which rounds go on which day, the
// days a month or week shows, and what a period adds up to. Days are your local days as YYYY-MM-DD,
// like useToday(). Weeks start on Monday.

import dayjs, { type Dayjs } from "dayjs";

export type Period = "month" | "week";

export interface CalendarRound {
  id: string;
  status: string;
  starts_at: string | null;
  deadline_at: string | null;
  needs_new_time_since?: string | null;
  rescheduled_count: number;
  company_name: string;
}

const DAY = "YYYY-MM-DD";

/** Monday of the week `day` is in. */
const monday = (day: Dayjs) => day.subtract((day.day() + 6) % 7, "day").startOf("day");

/** A round waiting for a new time: its old time isn't happening, so it goes with the rounds to book. */
const waitingForTime = (r: CalendarRound) => r.status === "scheduled" && !!r.needs_new_time_since;

/** The statuses a round can have (InterviewIn's enum). Any other, from a newer server, stays off the calendar. */
const KNOWN = new Set(["scheduled", "done", "cancelled"]);

/** The moment a round is at (its time, else its deadline), in ms; a date-only value is that local midnight. */
const momentOf = (r: CalendarRound) => dayjs(r.starts_at ?? r.deadline_at).valueOf();

/**
 * The local day a round is on (its time, else its deadline), or null when it has no place on the
 * calendar: no time yet, waiting for a new time, or a status this app doesn't know.
 */
export function roundDay(r: CalendarRound): string | null {
  const when = r.starts_at ?? r.deadline_at;
  if (!when || waitingForTime(r) || !KNOWN.has(r.status)) return null;
  return dayjs(when).format(DAY);
}

/** Open rounds with no time yet, or whose time has to move: listed beside the calendar. */
export function toBook<T extends CalendarRound>(rounds: readonly T[]): T[] {
  return rounds.filter(
    (r) => r.status === "scheduled" && (waitingForTime(r) || !(r.starts_at ?? r.deadline_at)),
  );
}

/**
 * Rounds by local day, each day's in time order: by the moment, so times in different zones compare
 * right. A date-only deadline counts as that day's midnight, so it comes first.
 */
export function byDay<T extends CalendarRound>(rounds: readonly T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  const placed = rounds.filter((r) => roundDay(r) !== null);
  const sorted = placed.sort((a, b) => momentOf(a) - momentOf(b));
  for (const r of sorted) {
    const day = roundDay(r);
    if (!day) continue;
    days.set(day, [...(days.get(day) ?? []), r]);
  }
  return days;
}

/** The first and last day of the month or week that `anchor` is in. */
export function periodRange(anchor: string, period: Period): { first: string; last: string } {
  const day = dayjs(anchor);
  if (period === "week") {
    const start = monday(day);
    return { first: start.format(DAY), last: start.add(6, "day").format(DAY) };
  }
  return { first: day.startOf("month").format(DAY), last: day.endOf("month").format(DAY) };
}

/** The same day a period earlier (-1) or later (1); a month from 31 Jan lands on the last of February. */
export function shiftPeriod(anchor: string, period: Period, by: number): string {
  return dayjs(anchor).add(by, period).format(DAY);
}

/** The days the grid shows: whole weeks, Monday to Sunday, covering the period. */
export function gridDays(anchor: string, period: Period): string[] {
  const { first, last } = periodRange(anchor, period);
  const start = monday(dayjs(first));
  const end = monday(dayjs(last)).add(6, "day");
  const days: string[] = [];
  for (let d = start; !d.isAfter(end, "day"); d = d.add(1, "day")) days.push(d.format(DAY));
  return days;
}

export interface Summary {
  /** Marked done. */
  held: number;
  /** Still to happen. */
  comingUp: number;
  /** Their time has passed and they're not marked done or cancelled yet. */
  awaiting: number;
  cancelled: number;
  /** Rounds in the period that were moved at least once and still went ahead or will (a cancelled
   * one counts only as cancelled). */
  rescheduled: number;
  /** Companies with a round in the period that wasn't cancelled, by name: rounds from the API carry
   * the company's name, not its id (sending `company_id` too would be an API change, left for later),
   * so two companies with the same name count once. */
  companies: number;
  /** Every round on the calendar in the period, cancelled ones too. */
  total: number;
}

/** What the rounds on the calendar between `first` and `last` (whole days, inclusive) add up to. */
export function summarise(
  rounds: readonly CalendarRound[],
  first: string,
  last: string,
  now: number,
): Summary {
  const s: Summary = {
    held: 0,
    comingUp: 0,
    awaiting: 0,
    cancelled: 0,
    rescheduled: 0,
    companies: 0,
    total: 0,
  };
  const companies = new Set<string>();
  for (const r of rounds) {
    const day = roundDay(r);
    if (!day || day < first || day > last) continue;
    s.total += 1;
    if (r.status === "cancelled") {
      s.cancelled += 1;
      continue;
    }
    if (r.rescheduled_count > 0) s.rescheduled += 1;
    companies.add(r.company_name);
    if (r.status === "done") s.held += 1;
    else if (momentOf(r) < now) s.awaiting += 1;
    else s.comingUp += 1;
  }
  s.companies = companies.size;
  return s;
}

/** The rounds that happened or will (not cancelled) in a period, for comparing it with the one before. */
export const activeRounds = (s: Summary) => s.total - s.cancelled;
