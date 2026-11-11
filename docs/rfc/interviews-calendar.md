# RFC: the Interviews calendar

Roadmap task `interviews-calendar`. Status: building (one PR).

## What it shows

The Interviews page gets a **Calendar | List** switch at the top. Calendar is the first view; the
choice is kept in localStorage (`jat.interviews.view`), and `?view=list` or `?view=calendar` opens one
(as on Applications).

- **Month** (the first choice) or **Week**, kept in `jat.interviews.period`. Weeks start on Monday.
  Previous and next move a whole period; **Today** comes back.
- **Rounds only**, not calls (meetings). A round with a time (or only a deadline, shown "Due 18:00")
  sits on its local day as a ticket: its status colour from `roundStatus` (blue coming up, orange
  awaiting outcome, teal done, grey and struck through cancelled), a small mark when rescheduled, its
  time and company, and in a week its name too. A month's day shows up to three; with more, two and
  "+N more", which opens the day's whole list.
- **Details** on hover or keyboard focus (a Mantine Popover, not a HoverCard, which doesn't open on
  focus): status, rescheduled badge, round name, time (with its end), company (a link) and role,
  interviewers, format, **Open the application**, and the list's own `RoundActions` (Done or Didn't
  happen, Reschedule, Edit), moved to `components/RoundActions.tsx` rather than copied. A click keeps
  the card open. The card stays mounted once shown, so a dialog opened from it survives it closing.
- **Still to book**, under the calendar: open rounds with no time and those waiting for a new time
  (their old time isn't happening, so they aren't on the calendar), in the list's table with its
  actions.
- **Figures** for the month or week on screen: held, awaiting outcome (only when some), coming up,
  cancelled, rescheduled (only when some), and companies (with a round that wasn't cancelled), a bar
  of how held, awaiting, coming up and cancelled split, and one line against the period before:
  rounds that weren't cancelled, "3 more rounds than October" or "1 fewer round than last week".
- **Phone width** (below 48em): an agenda, only the days with rounds, a date block beside each
  day's rounds in full. No sideways scroll.

All of it is worked out in the frontend from `GET /api/v1/interviews` (the page's `useInterviews({})`),
in `utils/calendar.ts` (unit-tested): no API change. Dates go through `utils/format.ts`, which gains
four patterns (`monthNameYear`, `monthName`, `shortWeekday`, `dayOfMonth`). Text is in the
`interviews` namespace, English and Chinese.

## Left for later

- Calls and meetings on the same calendar, with their own colour.
- A day view, or times laid out on an hour grid in the week.
- Dragging a round to another day to reschedule it.
- Add a round from an empty day.
- An `.ics` export or feed (needs an API route; it would also suit the MCP server).
