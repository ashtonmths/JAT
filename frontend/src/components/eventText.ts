import dayjs from "dayjs";

import type { ApiEvent } from "../api/client";
import { i18n } from "../i18n";
import type { TextKey } from "../locales/en";
import { callLabel } from "../utils/calls";
import { formatDay, formatMoney } from "../utils/format";
import { roundLabel } from "../utils/rounds";

export type EventMsg = NonNullable<ApiEvent["msg"]>;

// A key the API adds without text here is a type error.
export const EVENT_TEXT = {
  "event.linkAdded": "events:linkAdded",
  "event.noteAdded": "events:noteAdded",
  "event.fileAdded": "events:fileAdded",
  "event.email": "events:email",
  "event.emailNoSubject": "events:emailNoSubject",
  "event.emailUnknownSender": "events:emailUnknownSender",
  "event.emailNoSubjectUnknownSender": "events:emailNoSubjectUnknownSender",
  "event.cvSent": "events:cvSent",
  "event.coverLetterSent": "events:coverLetterSent",
  "event.documentSent": "events:documentSent",
  "event.roundScheduled": "events:roundScheduled",
  "event.roundAdded": "events:roundAdded",
  "event.roundCancelled": "events:roundCancelled",
  "event.roundBackOn": "events:roundBackOn",
  "event.roundDone": "events:roundDone",
  "event.roundRemoved": "events:roundRemoved",
  "event.roundRescheduled": "events:roundRescheduled",
  "event.roundRescheduledReason": "events:roundRescheduledReason",
  "event.roundRescheduledByMe": "events:roundRescheduledByMe",
  "event.roundRescheduledByThem": "events:roundRescheduledByThem",
  "event.roundRescheduledByMutual": "events:roundRescheduledByMutual",
  "event.roundRescheduledByNeither": "events:roundRescheduledByNeither",
  "event.roundRescheduledByMeReason": "events:roundRescheduledByMeReason",
  "event.roundRescheduledByThemReason": "events:roundRescheduledByThemReason",
  "event.roundRescheduledByMutualReason": "events:roundRescheduledByMutualReason",
  "event.roundRescheduledByNeitherReason": "events:roundRescheduledByNeitherReason",
  "event.roundNeedsNewTimeByMe": "events:roundNeedsNewTimeByMe",
  "event.roundNeedsNewTimeByThem": "events:roundNeedsNewTimeByThem",
  "event.roundNeedsNewTimeByMutual": "events:roundNeedsNewTimeByMutual",
  "event.roundNeedsNewTimeByNeither": "events:roundNeedsNewTimeByNeither",
  "event.roundNeedsNewTimeByMeReason": "events:roundNeedsNewTimeByMeReason",
  "event.roundNeedsNewTimeByThemReason": "events:roundNeedsNewTimeByThemReason",
  "event.roundNeedsNewTimeByMutualReason": "events:roundNeedsNewTimeByMutualReason",
  "event.roundNeedsNewTimeByNeitherReason": "events:roundNeedsNewTimeByNeitherReason",
  "event.roundNewTimeNotNeeded": "events:roundNewTimeNotNeeded",
  "event.callRescheduled": "events:callRescheduled",
  "event.callRescheduledReason": "events:callRescheduledReason",
  "event.callRescheduledByMe": "events:callRescheduledByMe",
  "event.callRescheduledByThem": "events:callRescheduledByThem",
  "event.callRescheduledByMutual": "events:callRescheduledByMutual",
  "event.callRescheduledByNeither": "events:callRescheduledByNeither",
  "event.callRescheduledByMeReason": "events:callRescheduledByMeReason",
  "event.callRescheduledByThemReason": "events:callRescheduledByThemReason",
  "event.callRescheduledByMutualReason": "events:callRescheduledByMutualReason",
  "event.callRescheduledByNeitherReason": "events:callRescheduledByNeitherReason",
  "event.offerReceivedYear": "events:offerReceivedYear",
  "event.offerReceivedDay": "events:offerReceivedDay",
  "event.offerReceivedNoFigures": "events:offerReceivedNoFigures",
  "event.offerBackYear": "events:offerBackYear",
  "event.offerBackDay": "events:offerBackDay",
  "event.offerBackNoFigures": "events:offerBackNoFigures",
  "event.offerAcceptedYear": "events:offerAcceptedYear",
  "event.offerAcceptedDay": "events:offerAcceptedDay",
  "event.offerAcceptedNoFigures": "events:offerAcceptedNoFigures",
  "event.offerDeclinedYear": "events:offerDeclinedYear",
  "event.offerDeclinedDay": "events:offerDeclinedDay",
  "event.offerDeclinedNoFigures": "events:offerDeclinedNoFigures",
  "event.offerWithdrawnYear": "events:offerWithdrawnYear",
  "event.offerWithdrawnDay": "events:offerWithdrawnDay",
  "event.offerWithdrawnNoFigures": "events:offerWithdrawnNoFigures",
  "event.offerRemovedYear": "events:offerRemovedYear",
  "event.offerRemovedDay": "events:offerRemovedDay",
  "event.offerRemovedNoFigures": "events:offerRemovedNoFigures",
  "event.followedUp": "events:followedUp",
  "event.noReply": "events:noReply",
  "event.replyToRead": "events:replyToRead",
  "event.replyRead": "events:replyRead",
  "event.repliedWaiting": "events:repliedWaiting",
  "event.heardBack": "events:heardBack",
  "event.undoMove": "events:undoMove",
  "event.recruiterChanged": "events:recruiterChanged",
  "event.recruiterSet": "events:recruiterSet",
  "event.recruiterRemoved": "events:recruiterRemoved",
  "event.recruiterChangedAgency": "events:recruiterChangedAgency",
  "event.recruiterSetAgency": "events:recruiterSetAgency",
  "event.recruiterRemovedAgency": "events:recruiterRemovedAgency",
  "event.recruiterChangedOnRole": "events:recruiterChangedOnRole",
  "event.recruiterSetOnRole": "events:recruiterSetOnRole",
  "event.rolePersonKeptAgency": "events:rolePersonKeptAgency",
  "event.rolePersonKeptUnnamedAgency": "events:rolePersonKeptUnnamedAgency",
  "event.rolePersonKeptDirect": "events:rolePersonKeptDirect",
} as const satisfies Record<EventMsg["key"], TextKey>;

/** A message saves raw parts where a language builds its own: a round's or a call's name, an offer's money. */
function textParams(msg: EventMsg): object {
  if (isRound(msg)) return { ...msg.params, label: roundLabel(msg.params) };
  if (isCall(msg)) return { ...msg.params, label: callLabel(msg.params) };
  if (isMoney(msg)) return { money: formatMoney(msg.params.amount, msg.params.currency, i18n.language) };
  return msg.params;
}

function isRound(msg: EventMsg): msg is Extract<EventMsg, { params: { round: number | null } }> {
  return "round" in msg.params;
}

function isCall(msg: EventMsg): msg is Extract<EventMsg, { params: { contact_name: string } }> {
  return "contact_name" in msg.params;
}

function isMoney(msg: EventMsg): msg is Extract<EventMsg, { params: { amount: number } }> {
  return "amount" in msg.params;
}

/**
 * What an event says: its message in your language, or the saved English `summary` for what has no
 * message (older events, your own words, an older server).
 */
export function eventText(event: Pick<ApiEvent, "summary" | "msg">): string | null {
  const msg = event.msg;
  if (!msg || !Object.hasOwn(EVENT_TEXT, msg.key)) return event.summary;
  // The key and its params come as a pair from the API's union; t() can't follow that across a lookup.
  return (i18n.t as unknown as (key: string, params: object) => string)(EVENT_TEXT[msg.key], textParams(msg));
}

export type RoundMove = NonNullable<ApiEvent["reschedule"]>;

// One whole line per who, with and without a reason. Whole keys, so the unused-key scanner sees them.
// A newer server's who is left unsaid.
const MOVE_BY = {
  me: "interviews:reschedule.move.timesBy.me",
  them: "interviews:reschedule.move.timesBy.them",
  mutual: "interviews:reschedule.move.timesBy.mutual",
  neither: "interviews:reschedule.move.timesBy.neither",
} as const;
const MOVE_BY_REASON = {
  me: "interviews:reschedule.move.timesByReason.me",
  them: "interviews:reschedule.move.timesByReason.them",
  mutual: "interviews:reschedule.move.timesByReason.mutual",
  neither: "interviews:reschedule.move.timesByReason.neither",
} as const;

/** A move, in one line: "Moved from Tue 3 Nov, 10:00 to Thu 5 Nov, 14:00 · They needed the change · Why". */
export function moveLine(move: RoundMove): string {
  // The year only when the move crosses one, in your time zone like the times themselves.
  const crossesYear = dayjs(move.from_at).year() !== dayjs(move.to_at).year();
  const pattern = crossesYear ? "shortWeekdayDayMonthYearTime" : "shortWeekdayDayMonthTime";
  const when = (iso: string) => formatDay(iso, pattern, i18n.language);
  const from = when(move.from_at);
  const to = when(move.to_at);
  const by = move.by && Object.hasOwn(MOVE_BY, move.by) ? move.by : null;
  const reason = move.reason; // your own words, as written
  if (by && reason) return i18n.t(MOVE_BY_REASON[by], { from, to, reason });
  if (by) return i18n.t(MOVE_BY[by], { from, to });
  if (reason) return i18n.t("interviews:reschedule.move.timesReason", { from, to, reason });
  return i18n.t("interviews:reschedule.move.times", { from, to });
}

/**
 * The short words above a move's line, "Round 2 · Technical rescheduled" or "Call with Alex Morgan
 * rescheduled", so its who and why aren't said twice. Null for anything else, which keeps its whole
 * message: no move, or a message that isn't a move's.
 */
export function movedRoundText(event: Pick<ApiEvent, "msg" | "reschedule">): string | null {
  const msg = event.msg;
  if (!event.reschedule || !msg) return null;
  if (msg.key.startsWith("event.roundRescheduled") && isRound(msg)) {
    return i18n.t("events:roundRescheduled", { label: roundLabel(msg.params) });
  }
  if (msg.key.startsWith("event.callRescheduled") && isCall(msg)) {
    return i18n.t("events:callRescheduled", { label: callLabel(msg.params) });
  }
  return null;
}
