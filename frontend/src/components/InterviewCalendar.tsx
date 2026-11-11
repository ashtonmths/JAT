import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import {
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useContacts } from "../api/hooks";
import type { Interview } from "../api/interviewHooks";
import { activeRounds, byDay, gridDays, periodRange, summarise, type Summary } from "../utils/calendar";
import { formatDay } from "../utils/format";
import { joinList } from "../utils/list";
import { roundLabel } from "../utils/rounds";
import { useNow, useToday } from "../utils/useToday";
import text from "../text.module.css";
import classes from "./InterviewCalendar.module.css";
import { roundStatus } from "./Interviews";
import { RecruiterLine } from "./RecruiterLine";
import { RescheduledBadge } from "./Reschedule";
import { RoundActions } from "./RoundActions";

/** What the calendar shows: one large month, or a year of small ones. */
export type CalendarView = "month" | "year";

const FORMATS = {
  video: "form.formats.video",
  phone: "form.formats.phone",
  onsite: "form.formats.onsite",
  take_home: "form.formats.take_home",
} as const;

const DAY = "YYYY-MM-DD";
const MONTH = "month" as const;

/** A round's time on the calendar: its start, else its deadline. */
const whenOf = (r: Interview) => (r.starts_at ?? r.deadline_at)!;

/** The first and last day of the month or year `anchor` is in. */
function rangeOf(anchor: string, view: CalendarView) {
  if (view === "month") return periodRange(anchor, MONTH);
  const d = dayjs(anchor);
  return { first: d.startOf("year").format(DAY), last: d.endOf("year").format(DAY) };
}

/** The same day a month or year earlier (-1) or later (1). */
const shift = (anchor: string, view: CalendarView, by: number) => dayjs(anchor).add(by, view).format(DAY);

/** Everything about a round, with its actions: a card in the day panel. */
function RoundDetails({ round, people }: { round: Interview; people: string[] }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const status = roundStatus(round);
  const from = formatDay(whenOf(round), "shortWeekdayDayMonthYearTime", lang);
  const when = round.starts_at
    ? round.ends_at
      ? t("calendar.timeRange", { from, to: formatDay(round.ends_at, "time", lang) })
      : from
    : t("due", { when: from });
  const format =
    round.format && Object.hasOwn(FORMATS, round.format)
      ? FORMATS[round.format as keyof typeof FORMATS]
      : null;
  return (
    <Stack gap={6}>
      <Group gap={4}>
        <Badge size="sm" variant="light" color={status.color}>
          {status.label}
        </Badge>
        <RescheduledBadge interview={round} />
      </Group>
      <div>
        <Text fw={650} size="sm">
          {roundLabel(round)}
        </Text>
        <Text size="sm">{when}</Text>
      </div>
      <div>
        <Anchor component={Link} to={`/applications/${round.application_id}`} size="sm" fw={600}>
          {round.company_name}
        </Anchor>
        <Text size="xs" c="dimmed">
          <RecruiterLine id={round.recruiter_id} name={round.recruiter_name}>
            {round.role_title}
          </RecruiterLine>
        </Text>
      </div>
      {(people.length > 0 || format) && (
        <div>
          {people.length > 0 && (
            <Text size="xs" c="dimmed">
              {t("calendar.with", { people: joinList(people) })}
            </Text>
          )}
          {format && (
            <Text size="xs" c="dimmed">
              {t(format)}
            </Text>
          )}
        </div>
      )}
      <Group justify="space-between" gap="xs" mt={4} wrap="nowrap">
        <Anchor
          component={Link}
          to={`/applications/${round.application_id}`}
          size="xs"
          className={text.keepWords}
        >
          {t("calendar.openApplication")}
        </Anchor>
        <RoundActions interview={round} />
      </Group>
    </Stack>
  );
}

/** The figures for the month or year on screen, a bar of how they split, and the one before. */
function PeriodSummary({
  now,
  prev,
  view,
  anchor,
}: {
  now: Summary;
  prev: Summary;
  view: CalendarView;
  anchor: string;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  if (!now.total) {
    return (
      <Text size="sm" c="dimmed">
        {view === "month" ? t("calendar.noRoundsMonth") : t("calendar.noRoundsYear")}
      </Text>
    );
  }
  const stats = [
    { id: "held", n: now.held, color: "teal", text: t("calendar.summary.held", { count: now.held }) },
    {
      id: "awaiting",
      n: now.awaiting,
      color: "orange",
      text: t("calendar.summary.awaiting", { count: now.awaiting }),
    },
    {
      id: "comingUp",
      n: now.comingUp,
      color: "blue",
      text: t("calendar.summary.comingUp", { count: now.comingUp }),
    },
    {
      id: "cancelled",
      n: now.cancelled,
      color: "gray",
      text: t("calendar.summary.cancelled", { count: now.cancelled }),
    },
    {
      id: "rescheduled",
      n: now.rescheduled,
      color: "yellow",
      text: t("calendar.summary.rescheduled", { count: now.rescheduled }),
    },
    {
      id: "companies",
      n: now.companies,
      color: null,
      text: t("calendar.summary.companies", { count: now.companies }),
    },
  ].filter((s) => s.n > 0 || s.id === "held" || s.id === "comingUp" || s.id === "companies");
  const diff = activeRounds(now) - activeRounds(prev);
  const month = formatDay(shift(anchor, "month", -1), "monthName", lang);
  const year = formatDay(shift(anchor, "year", -1), "yearOnly", lang);
  const compare =
    view === "month"
      ? diff > 0
        ? t("calendar.summary.moreThanMonth", { count: diff, month })
        : diff < 0
          ? t("calendar.summary.fewerThanMonth", { count: -diff, month })
          : t("calendar.summary.sameAsMonth", { month })
      : diff > 0
        ? t("calendar.summary.moreThanYear", { count: diff, year })
        : diff < 0
          ? t("calendar.summary.fewerThanYear", { count: -diff, year })
          : t("calendar.summary.sameAsYear", { year });
  const bar = stats.filter((s) => ["held", "awaiting", "comingUp", "cancelled"].includes(s.id) && s.n > 0);
  return (
    <Stack gap={8}>
      <Group gap="lg" style={{ rowGap: 8 }}>
        {stats.map((s) => (
          <div key={s.id} className={classes.stat} data-stat={s.id}>
            {s.color && <span className={classes.statDot} style={dotColor(s.color)} />}
            <span className={classes.statNumber}>{s.n}</span>
            <Text span size="sm" c="dimmed">
              {s.text}
            </Text>
          </div>
        ))}
      </Group>
      <Progress.Root size={6} aria-hidden>
        {bar.map((s) => (
          <Progress.Section key={s.id} value={(s.n / now.total) * 100} color={s.color!} />
        ))}
      </Progress.Root>
      {(prev.total > 0 || diff !== 0) && (
        <Text size="xs" c="dimmed">
          {compare}
        </Text>
      )}
    </Stack>
  );
}

/** A day's colour: what most needs you first (awaiting an outcome), then coming up, held, cancelled. */
const TONES = ["orange", "blue", "teal", "red", "gray"];
function tone(rounds: Interview[]): string {
  const colors = rounds.map((r) => roundStatus(r).color);
  return TONES.find((c) => colors.includes(c)) ?? "gray";
}

const dotColor = (color: string) => ({ "--dot": `var(--mantine-color-${color}-filled)` }) as CSSProperties;

/**
 * The day the panel shows: the one you picked while it's on screen; else today if it has rounds, or the
 * next day that does; else the first day with rounds on screen, or today, or the first day on screen.
 */
function useChosenDay(days: Map<string, Interview[]>, today: string, first: string, last: string) {
  const [picked, setPicked] = useState<string | null>(null);
  const busy = [...days.keys()].filter((d) => d >= first && d <= last).sort();
  const fallback =
    busy.find((d) => d >= today) ?? (today >= first && today <= last ? today : (busy[0] ?? first));
  const day = picked && picked >= first && picked <= last ? picked : fallback;
  return [day, setPicked] as const;
}

/** The chosen day's rounds, each as its card with its actions. */
function DayPanel({ day, days, names }: { day: string; days: Map<string, Interview[]>; names: Names }) {
  const { t, i18n } = useTranslation("interviews");
  const here = days.get(day) ?? [];
  return (
    <section aria-label={t("calendar.dayPanel")} aria-live="polite">
      <Text fw={650} mb="sm">
        {formatDay(day, "weekdayDayMonth", i18n.language)}
      </Text>
      <Stack gap="sm">
        {here.length ? (
          here.map((r) => (
            <Paper key={r.id} withBorder radius="md" p="sm" data-round={r.id}>
              <RoundDetails round={r} people={names(r)} />
            </Paper>
          ))
        ) : (
          <Text size="sm" c="dimmed">
            {t("calendar.noRoundsDay")}
          </Text>
        )}
      </Stack>
    </section>
  );
}

type Names = (r: Interview) => string[];

/** A small figure with an icon, its words in a tooltip and for screen readers: "✓ 3". */
function IconStat({ icon, n, label }: { icon: ReactNode; n: number; label: string }) {
  return (
    <Tooltip label={label} withArrow>
      <span className={classes.iconStat} role="img" aria-label={label}>
        {icon}
        <span aria-hidden>{n}</span>
      </span>
    </Tooltip>
  );
}

/** A month's held, coming up and companies, as small figures with icons (the year's months). */
function MonthStats({ s }: { s: Summary }) {
  const { t } = useTranslation("interviews");
  return (
    <Group gap={12} wrap="nowrap">
      <IconStat
        icon={<IconCircleCheck size={15} stroke={1.8} />}
        n={s.held}
        label={t("calendar.monthStats.held", { count: s.held })}
      />
      <IconStat
        icon={<IconClock size={15} stroke={1.8} />}
        n={s.comingUp + s.awaiting}
        label={t("calendar.monthStats.comingUp", { count: s.comingUp + s.awaiting })}
      />
      <IconStat
        icon={<IconBuilding size={15} stroke={1.8} />}
        n={s.companies}
        label={t("calendar.monthStats.companies", { count: s.companies })}
      />
    </Group>
  );
}

/**
 * A month as a grid of dots: a small grey one for a quiet day, a bigger one in its status's colour for
 * a day with rounds (bigger again with more, the number inside). Pick a day to see its rounds. `large`
 * is the month view; the year's months are small, each with its figures.
 */
function DotMonth({
  month,
  days,
  today,
  chosen,
  onChoose,
  large,
  stats,
}: {
  month: string;
  days: Map<string, Interview[]>;
  today: string;
  chosen: string;
  onChoose: (day: string) => void;
  large: boolean;
  stats?: Summary;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const cells = gridDays(month, MONTH);
  const name = formatDay(month, "monthNameYear", lang);
  return (
    <section className={classes.month} aria-label={name} data-large={large || undefined}>
      {stats && (
        <Stack gap={4} mb="md">
          <Text fw={650} size="lg">
            {formatDay(month, "monthName", lang)}
          </Text>
          <MonthStats s={stats} />
        </Stack>
      )}
      <div className={classes.dotGrid}>
        {cells.slice(0, 7).map((d) => (
          <span key={`h${d}`} className={classes.dotHead} aria-hidden>
            {formatDay(d, large ? "shortWeekday" : "minWeekday", lang)}
          </span>
        ))}
        {cells.map((d) => {
          if (d.slice(0, 7) !== month.slice(0, 7)) return <span key={d} className={classes.dotCell} />;
          const here = days.get(d) ?? [];
          const label = t("calendar.dayLabel", {
            count: here.length,
            day: formatDay(d, "weekdayDayMonth", lang),
          });
          return (
            <span
              key={d}
              className={classes.dotCell}
              data-today={d === today || undefined}
              data-chosen={d === chosen || undefined}
            >
              {large && <span className={classes.cellNumber}>{formatDay(d, "dayOfMonth", lang)}</span>}
              {here.length ? (
                <Tooltip label={label} withArrow openDelay={300}>
                  <UnstyledButton
                    className={classes.bigDot}
                    style={dotColor(tone(here))}
                    data-size={String(Math.min(here.length, 3))}
                    data-tone={tone(here)}
                    data-day={d}
                    aria-label={label}
                    aria-pressed={d === chosen}
                    onClick={() => onChoose(d)}
                  >
                    {here.length > 1 ? here.length : null}
                  </UnstyledButton>
                </Tooltip>
              ) : (
                <span className={classes.smallDot} />
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** The calendar beside the day panel; on a phone the panel goes under it, or (`panelFirst`) above. */
function WithPanel({ main, panel, panelFirst }: { main: ReactNode; panel: ReactNode; panelFirst: boolean }) {
  return (
    <div className={classes.withPanel} data-panel-first={panelFirst || undefined}>
      <div className={classes.main}>{main}</div>
      <div className={classes.panel}>{panel}</div>
    </div>
  );
}

/**
 * The Interviews page's calendar: a month of dots or a year of small months, the period's figures above,
 * previous, next and today, and the chosen day's rounds beside. Rounds not booked yet are listed by the
 * page, under it.
 */
export function InterviewCalendar({ rounds }: { rounds: Interview[] }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const today = useToday();
  const now = useNow();
  const phone = useMediaQuery("(max-width: 48em)");
  const [anchor, setAnchor] = useState(today);
  const [stored, setView] = useLocalStorage<CalendarView>({
    key: "jat.interviews.period",
    defaultValue: "month",
    getInitialValueInEffect: false,
  });
  // An earlier version kept "week" here.
  const view: CalendarView = stored === "year" ? "year" : "month";
  const { data: contacts } = useContacts();
  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const names = (r: Interview) => r.interviewer_ids.flatMap((id) => contactNames.get(id) ?? []);

  const days = byDay(rounds);
  const { first, last } = rangeOf(anchor, view);
  const before = rangeOf(shift(anchor, view, -1), view);
  const [day, setDay] = useChosenDay(days, today, first, last);
  const heading = formatDay(anchor, view === "month" ? "monthNameYear" : "yearOnly", lang);
  const months = Array.from(
    { length: 12 },
    (_, i) => `${first.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`,
  );

  const calendar =
    view === "month" ? (
      <DotMonth month={first} days={days} today={today} chosen={day} onChoose={setDay} large />
    ) : (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={36} verticalSpacing={36}>
        {months.map((m) => {
          const range = periodRange(m, MONTH);
          return (
            <DotMonth
              key={m}
              month={m}
              days={days}
              today={today}
              chosen={day}
              onChoose={setDay}
              large={false}
              stats={summarise(rounds, range.first, range.last, now)}
            />
          );
        })}
      </SimpleGrid>
    );

  return (
    <Card withBorder padding="lg" className={classes.root}>
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Group gap={6} wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label={view === "month" ? t("calendar.previousMonth") : t("calendar.previousYear")}
              onClick={() => setAnchor(shift(anchor, view, -1))}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label={view === "month" ? t("calendar.nextMonth") : t("calendar.nextYear")}
              onClick={() => setAnchor(shift(anchor, view, 1))}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
            <Title order={3} ml={6} fz={phone ? "h4" : "h3"} aria-live="polite">
              {heading}
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Button size="xs" variant="default" onClick={() => setAnchor(today)}>
              {t("calendar.today")}
            </Button>
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(v) => setView(v as CalendarView)}
              data={[
                { value: "month", label: t("calendar.month") },
                { value: "year", label: t("calendar.year") },
              ]}
              aria-label={t("calendar.period")}
            />
          </Group>
        </Group>
        <section aria-label={t("calendar.summary.label", { period: heading })}>
          <PeriodSummary
            now={summarise(rounds, first, last, now)}
            prev={summarise(rounds, before.first, before.last, now)}
            view={view}
            anchor={anchor}
          />
        </section>
        <WithPanel
          main={calendar}
          panel={<DayPanel day={day} days={days} names={names} />}
          panelFirst={view === "year"}
        />
      </Stack>
    </Card>
  );
}
