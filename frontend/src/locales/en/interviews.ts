// Interviews: the Interviews page, rounds on an application, the round form and Reschedule
// (docs/rfc/i18n.md §15). What a round is called in your own words, companies and people are
// values: they're your data.
export default {
  // A round's name: "Round 2 · System design test". {{what}} is your description, else its kind.
  label: "Round {{round}} · {{what}}",
  // The round badge on cards and rows, when it's booked: "Round 2 · Technical · Thu 2 Oct".
  badgeWhen: "{{label}} · {{when}}",
  // A round with no description goes by its kind ("other" reads "Interview" here).
  kindNames: {
    screen: "Screen",
    hiring_manager: "Hiring manager",
    technical: "Technical",
    coding_task: "Coding task",
    system_design: "System design",
    pairing: "Pairing",
    behavioural: "Behavioural",
    onsite: "Onsite",
    final: "Final",
    other: "Interview",
  },
  // The Type list in the round form ("other" reads "Other" here).
  kinds: {
    screen: "Screen",
    hiring_manager: "Hiring manager",
    technical: "Technical",
    coding_task: "Coding task",
    system_design: "System design",
    pairing: "Pairing",
    behavioural: "Behavioural",
    onsite: "Onsite",
    final: "Final",
    other: "Other",
  },
  status: {
    comingUp: "Coming up",
    done: "Done",
    cancelled: "Cancelled",
    awaitingOutcome: "Awaiting outcome",
  },
  // Where a round stands in time, on the page and the application.
  due: "Due {{when}}",
  notBooked: "Not booked yet",
  edit: "Edit",
  editNamed: "Edit {{label}}",
  deleteConfirm: "Delete {{label}}?",
  page: {
    title: "Interviews",
    comingUp: "Coming up",
    comingUpEmpty: "Nothing booked. Add interview rounds from an application's page.",
    // Rounds that can't go ahead at their time, with no new one agreed yet. Only shown when there are some.
    needsNewTime: "Needs a new time",
    earlier: "Earlier and cancelled",
    earlierEmpty: "None yet.",
    when: "When",
    round: "Round",
    application: "Application",
    status: "Status",
  },
  // The Interviews card on an application.
  card: {
    title: "Interviews",
    addRound: "Add round {{round}}",
    whenWith: "{{when}} · with {{people}}",
    joinLink: "Join link",
    empty:
      'No interviews yet. Add each round as it\'s booked: "Round 1 · Recruiter screen", "Round 2 · Engineering manager chat"…',
  },
  form: {
    editTitle: "Edit {{label}}",
    addTitle: "Add an interview round",
    linkError: "Links start with http:// or https://",
    roundError: "Rounds go from 1 to 99",
    round: "Round",
    what: "What is it?",
    whatPlaceholder: "Engineering manager chat, System design test…",
    type: "Type",
    format: "Format",
    formatPlaceholder: "Not set",
    formats: {
      video: "Video call",
      phone: "Phone",
      onsite: "In person",
      take_home: "Take-home",
    },
    status: "Status",
    when: "When",
    whenPlaceholder: "Not booked yet",
    due: "Due",
    duePlaceholder: "No deadline",
    meetingLink: "Meeting link",
    linkPlaceholder: "https://…",
    location: "Location",
    locationPlaceholder: "Office, floor 3",
    interviewers: "Interviewers",
    interviewersPlaceholder: "Pick people",
    taskInstructions: "Task instructions",
    repoLink: "Repo or platform link",
    prep: "Prep",
    prepPlaceholder: "What to read up on",
    debrief: "Debrief",
    debriefPlaceholder: "How it went",
    questions: "Questions asked",
    add: "Add round",
  },
  reschedule: {
    action: "Reschedule",
    named: "Reschedule {{label}}",
    badge: "Rescheduled",
    // More than once: "Rescheduled ×2".
    badgeTimes: "Rescheduled ×{{times}}",
    movedFrom: "Moved from {{when}}",
    where: "{{company}} · {{role}}",
    whereWas: "{{company}} · {{role}} · was {{when}}",
    newTime: "New time",
    who: "Who needed the change?",
    whoRequired: "Choose who needed the change",
    whoOptions: {
      me: "Me",
      them: "Them",
      mutual: "Both of us",
      neither: "Neither of us",
    },
    // A round's moves added up, from the times saved with each. They can cancel out, then nothing shows.
    pushedBack_one: "Pushed back {{count}} day in total.",
    pushedBack_other: "Pushed back {{count}} days in total.",
    broughtForward_one: "Brought forward {{count}} day in total.",
    broughtForward_other: "Brought forward {{count}} days in total.",
    notCounted_one: "{{count}} other move has no saved times, so it isn't counted.",
    notCounted_other: "{{count}} other moves have no saved times, so they aren't counted.",
    why: "Why? (optional)",
    whyPlaceholder: "They had a clash, you asked to move it…",
    // A move's line on a timeline, one whole line for each state: who needed the change (when saved)
    // and why (when given). {{from}} and {{to}} are dates and times, with the year when the move
    // crosses one; {{reason}} is your own words, shown as written.
    move: {
      times: "Moved from {{from}} to {{to}}",
      timesReason: "Moved from {{from}} to {{to}} · {{reason}}",
      timesBy: {
        me: "Moved from {{from}} to {{to}} · You needed the change",
        them: "Moved from {{from}} to {{to}} · They needed the change",
        mutual: "Moved from {{from}} to {{to}} · You both needed the change",
        neither: "Moved from {{from}} to {{to}} · Not down to either of you",
      },
      timesByReason: {
        me: "Moved from {{from}} to {{to}} · You needed the change · {{reason}}",
        them: "Moved from {{from}} to {{to}} · They needed the change · {{reason}}",
        mutual: "Moved from {{from}} to {{to}} · You both needed the change · {{reason}}",
        neither: "Moved from {{from}} to {{to}} · Not down to either of you · {{reason}}",
      },
    },
  },
  // A booked round that can't go ahead at its time, with no new time agreed yet.
  needsNewTime: {
    choice: "A new time isn't agreed yet",
    choiceHint: "The round keeps its old time and shows as needing a new one.",
    addTodo: "Add a to-do to book the new time",
    todoDue: "To-do due",
    // The to-do's own text, in your words once it's made.
    todoText: "Book a new time for {{label}}",
    todoHint:
      "The to-do stays open until the round has its new time. Setting that, with Set new time or Edit, counts as the move from the old time and ticks the to-do off for you.",
    save: "Save: needs a new time",
    badge: "Needs a new time",
    roundBadge: "{{label}} · needs a new time",
    // The round's old time and who needed the change, one sentence for each.
    was: {
      me: "Was {{when}}. You needed the change.",
      them: "Was {{when}}. They needed the change.",
      mutual: "Was {{when}}. You both needed the change.",
      neither: "Was {{when}}. Not down to either of you.",
      unsaid: "Was {{when}}.",
    },
    // The same once its old time has been cleared from its form.
    noTime: {
      me: "It has no time now. You needed the change.",
      them: "It has no time now. They needed the change.",
      mutual: "It has no time now. You both needed the change.",
      neither: "It has no time now. Not down to either of you.",
      unsaid: "It has no time now.",
    },
    marked: "{{label}} needs a new time.",
    setAction: "Set new time",
    setNamed: "Set a new time for {{label}}",
    setHint: "Setting it counts as the move from the old time, and ticks off any to-do made to book it.",
    keepOld: "Keep the old time",
    // In the Edit form, after the old time and who needed the change.
    editHint:
      "Setting a new time here counts as the move from the old one, and ticks off any to-do made to book it.",
  },
} as const;
