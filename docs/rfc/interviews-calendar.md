# RFC: the Interviews calendar

Roadmap task `interviews-calendar`. Status: building. Part 1, the date and summary helpers
(`utils/calendar.ts`), landed in #325; this is the view.

## What it shows

The Interviews page gets a **Calendar | List** switch at the top. Calendar is the first view. The
choice is kept in localStorage (`jat.interviews.view`), and `?view=list` or `?view=calendar` opens one,
as on Applications.

The calendar's look was chosen from design concepts shown on a dev server (#326, closed). Kai picked
two, as a **Month · Year** switch, kept in `jat.interviews.period` (an older "week" there reads as
month). Month comes first. Weeks start on Monday.

- **Month:** one large month of dots, with previous, next and **Today**. A quiet day is a small grey
  dot. A day with rounds gets a bigger dot in its status's colour: what most needs you first, so
  orange for awaiting an outcome, then blue for coming up, teal for held, faded grey for cancelled.
  Two or more rounds make the dot bigger, with the number inside. Today has a ring.
- **Year:** the twelve months of the calendar year as small dot months, three across (two, then one,
  on narrower screens). Each month has small figures with icons: held, coming up, companies.
  Previous and next move a year; **Today** comes back.
- **The day panel**, beside the calendar: the chosen day's rounds as cards. Each card has the status,
  rescheduled badge, round name, time (with its end), company (a link) and role, interviewers and
  format. It also has **Open the application** and the list's own `RoundActions` (Done or Didn't
  happen, Reschedule, Edit). Choosing a dot changes the day. With none chosen, it shows today if
  today has rounds, else the next day that does. Failing that, it shows the first day with rounds
  on screen, today, or the first day on screen. The panel stays in view while a year scrolls.
- **Rounds only**, not calls (meetings). A round with a time, or only a deadline, sits on its local
  day. Rounds with no time, and those waiting for a new time, are listed under the calendar as
  **Still to book**, in the list's table with its actions.
- **Figures** for the month or year on screen: held, awaiting outcome (only when some), coming up,
  cancelled, rescheduled (only when some), and companies (with a round that wasn't cancelled). A bar
  shows how held, awaiting, coming up and cancelled split. One line compares the rounds that weren't
  cancelled with the period before: "3 more rounds than October", "2 fewer rounds than 2025".
- **Phone width** (below 48em): the panel goes under the month, and above the twelve months of a year,
  so the chosen day's rounds aren't below them all. No sideways scroll.

It's all worked out in the frontend from `GET /api/v1/interviews` (the page's `useInterviews({})`),
with `utils/calendar.ts`: no API change. Dates go through `utils/format.ts`, which gains `minWeekday`
and `yearOnly`. Text is in the `interviews` namespace, English and Chinese.

## Left for later

- Calls and meetings on the same calendar, with their own colour.
- Counting companies by id: the interviews API sends the company's name only.
- Dragging a round to another day to reschedule it.
- Add a round from an empty day.
- An `.ics` export or feed (needs an API route; it would also suit the MCP server).
