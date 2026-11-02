import { Badge, Button, Checkbox, Group, Modal, Select, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Schemas } from "../api/client";
import {
  useKeepOldTime,
  useMarkNeedsNewTime,
  useSaveInterview,
  useUndoNeedsNewTime,
  type Interview,
} from "../api/interviewHooks";
import { i18n } from "../i18n";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";
import { useToday } from "../utils/useToday";

const PICKER = "YYYY-MM-DD HH:mm:ss";

/** "Rescheduled" (or "Rescheduled ×2") on a round that moved, with the time it moved from. */
export function RescheduledBadge({
  interview,
  size = "sm",
}: {
  interview: Pick<Interview, "rescheduled_count" | "rescheduled_from">;
  size?: "xs" | "sm";
}) {
  const { t } = useTranslation("interviews");
  const n = interview.rescheduled_count;
  if (!n) return null;
  const badge = (
    <Badge size={size} variant="light" color="yellow">
      {n > 1 ? t("reschedule.badgeTimes", { times: n }) : t("reschedule.badge")}
    </Badge>
  );
  if (!interview.rescheduled_from) return badge;
  return (
    <Tooltip
      label={t("reschedule.movedFrom", { when: formatDateTime(interview.rescheduled_from) })}
      withArrow
    >
      {badge}
    </Tooltip>
  );
}

/**
 * How far a round's moves took it, in calendar days where you are, as the timeline shows them: later
 * is positive. It's the net, so +5 then -2 is 3; it's only ever from moves with both times saved.
 */
export function daysMoved(moves: { from_at: string; to_at: string }[]) {
  return moves.reduce(
    (days, m) => days + dayjs(m.to_at).startOf("day").diff(dayjs(m.from_at).startOf("day"), "day"),
    0,
  );
}

/** "Pushed back 3 days in total." for a round whose saved moves add up to a different day. */
export function RoundDaysMoved({ interview }: { interview: Pick<Interview, "rescheduled_count" | "moves"> }) {
  const { t } = useTranslation("interviews");
  const moves = interview.moves ?? [];
  const days = daysMoved(moves);
  if (!days) return null;
  const unknown = Math.max(0, interview.rescheduled_count - moves.length);
  return (
    <Text size="sm" c="dimmed">
      {days > 0
        ? t("reschedule.pushedBack", { count: days })
        : t("reschedule.broughtForward", { count: -days })}
      {unknown > 0 && ` ${t("reschedule.notCounted", { count: unknown })}`}
    </Text>
  );
}

/** What the dialog needs of a round: the board's and quick view's summary has no end time, and needn't. */
type Reschedulable = Pick<
  Interview,
  "id" | "round" | "title" | "kind" | "starts_at" | "needs_new_time_since" | "needs_new_time_by"
> & {
  company_name: string;
  role_title: string;
};

const WAS = {
  me: "interviews:needsNewTime.was.me",
  them: "interviews:needsNewTime.was.them",
  mutual: "interviews:needsNewTime.was.mutual",
  neither: "interviews:needsNewTime.was.neither",
} as const;

const NO_TIME = {
  me: "interviews:needsNewTime.noTime.me",
  them: "interviews:needsNewTime.noTime.them",
  mutual: "interviews:needsNewTime.noTime.mutual",
  neither: "interviews:needsNewTime.noTime.neither",
} as const;

/**
 * "Was Tue 3 Nov, 10:00. They needed the change." for a round waiting for a new time, or "It has no
 * time now. They needed the change." once its old time has been cleared from its form.
 */
export function wasText(round: Pick<Interview, "starts_at" | "needs_new_time_by">): string {
  const by = round.needs_new_time_by;
  if (!round.starts_at) return i18n.t(by ? NO_TIME[by] : "interviews:needsNewTime.noTime.unsaid");
  return i18n.t(by ? WAS[by] : "interviews:needsNewTime.was.unsaid", {
    when: formatDateTime(round.starts_at),
  });
}

/** "Needs a new time", with the old time and who needed the change on hover; nothing for any other round. */
export function NeedsNewTimeBadge({
  interview,
  size = "sm",
}: {
  interview: Pick<Interview, "starts_at" | "needs_new_time_since" | "needs_new_time_by">;
  size?: "xs" | "sm";
}) {
  const { t } = useTranslation("interviews");
  if (!interview.needs_new_time_since) return null;
  return (
    <Tooltip label={wasText(interview)} withArrow>
      <Badge size={size} variant="light" color="red">
        {t("needsNewTime.badge")}
      </Badge>
    </Tooltip>
  );
}

/** "Round 2 · Technical needs a new time." with an Undo that gives it back its old time. */
function notifyMarked(interview: Reschedulable, undo: () => void) {
  const id = notifications.show({
    autoClose: 8000, // long enough to reach Undo from the keyboard
    message: (
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm">{i18n.t("interviews:needsNewTime.marked", { label: roundLabel(interview) })}</Text>
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            notifications.hide(id);
            undo();
          }}
        >
          {i18n.t("common:actions.undo")}
        </Button>
      </Group>
    ),
  });
}
type RescheduleBy = NonNullable<Schemas["InterviewPatch"]["reschedule_by"]>;
const WHO = [
  { value: "me", key: "interviews:reschedule.whoOptions.me" },
  { value: "them", key: "interviews:reschedule.whoOptions.them" },
  { value: "mutual", key: "interviews:reschedule.whoOptions.mutual" },
  { value: "neither", key: "interviews:reschedule.whoOptions.neither" },
] as const satisfies readonly { value: RescheduleBy; key: string }[];

/**
 * The Reschedule button and its dialog, for a booked round; Set new time for one waiting for a new
 * time, even if its old time has since been cleared; nothing for any other.
 */
export function RescheduleButton({ interview }: { interview: Reschedulable & { status: string } }) {
  const { t } = useTranslation("interviews");
  const [open, setOpen] = useState(false);
  if (interview.status !== "scheduled") return null;
  const label = roundLabel(interview);
  if (interview.needs_new_time_since) {
    return (
      <>
        <Button
          size="compact-xs"
          variant="light"
          color="red"
          aria-label={t("needsNewTime.setNamed", { label })}
          onClick={() => setOpen(true)}
        >
          {t("needsNewTime.setAction")}
        </Button>
        {open && <SetNewTimeModal interview={interview} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (!interview.starts_at) return null;
  return (
    <>
      <Button
        size="compact-xs"
        variant="light"
        aria-label={t("reschedule.named", { label })}
        onClick={() => setOpen(true)}
      >
        {t("reschedule.action")}
      </Button>
      {open && <RescheduleModal interview={interview} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Give a round waiting for a new time that time: the move from its old one, with the who and why it
 * was marked with, and its to-do ticked off (the API does both). Or it keeps its old time after all.
 */
function SetNewTimeModal({ interview, onClose }: { interview: Reschedulable; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "common"]);
  const save = useSaveInterview();
  const keep = useKeepOldTime();
  const [when, setWhen] = useState<string | null>(null);
  const busy = save.isPending || keep.isPending;
  const moved = when !== null && !dayjs(when).isSame(dayjs(interview.starts_at), "minute");
  return (
    <Modal
      opened
      onClose={onClose}
      title={t("needsNewTime.setNamed", { label: roundLabel(interview) })}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t("reschedule.where", { company: interview.company_name, role: interview.role_title })}
        </Text>
        <Text size="sm">{wasText(interview)}</Text>
        <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
        <Text size="sm" c="dimmed">
          {t("needsNewTime.setHint")}
        </Text>
        <Group justify={interview.starts_at ? "space-between" : "flex-end"}>
          {/* With its old time cleared, there's no old time to keep. */}
          {interview.starts_at && (
            <Button
              variant="subtle"
              onClick={() => keep.mutate(interview.id, { onSuccess: onClose })}
              disabled={busy}
            >
              {t("needsNewTime.keepOld")}
            </Button>
          )}
          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={() =>
                save.mutate(
                  { id: interview.id, body: { starts_at: dayjs(when).toISOString() } },
                  { onSuccess: onClose },
                )
              }
              disabled={!moved || keep.isPending}
              loading={save.isPending}
            >
              {t("common:actions.save")}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * Move a booked round to a new time, say who needed that and, if you like, why (they go on the
 * application's timeline). The API moves its end with it, so it lasts as long as before.
 */
export function RescheduleModal({ interview, onClose }: { interview: Reschedulable; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "common"]);
  const save = useSaveInterview();
  const [when, setWhen] = useState<string | null>(
    interview.starts_at ? dayjs(interview.starts_at).format(PICKER) : null,
  );
  const [who, setWho] = useState<RescheduleBy | null>(null);
  const [whoMissing, setWhoMissing] = useState(false);
  const [reason, setReason] = useState("");
  // No new time agreed yet: it keeps the old one, and you can add a to-do (open) to book the new one.
  const [noTimeYet, setNoTimeYet] = useState(false);
  const [addTodo, setAddTodo] = useState(true);
  const today = useToday();
  const [due, setDue] = useState<string | null>(today);
  const mark = useMarkNeedsNewTime();
  const undo = useUndoNeedsNewTime();
  const busy = save.isPending || mark.isPending;
  // To the minute: a change of seconds or fractions alone is no move.
  const moved = when !== null && !dayjs(when).isSame(dayjs(interview.starts_at), "minute");
  const submit = () => {
    if (!noTimeYet && !when) return;
    if (!who) {
      setWhoMissing(true);
      return;
    }
    if (noTimeYet) {
      const todo = addTodo
        ? { text: t("needsNewTime.todoText", { label: roundLabel(interview) }), due_on: due }
        : null;
      mark.mutate(
        { id: interview.id, body: { by: who, reason: reason.trim() || null, todo } },
        {
          onSuccess: () => {
            onClose();
            notifyMarked(interview, () => void undo(interview.id));
          },
        },
      );
      return;
    }
    save.mutate(
      {
        id: interview.id,
        body: {
          starts_at: dayjs(when).toISOString(),
          reschedule_by: who,
          reschedule_reason: reason.trim() || null,
        },
      },
      { onSuccess: onClose },
    );
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={t("reschedule.named", { label: roundLabel(interview) })}
      // While saving, nothing closes it: if the save fails, what you typed is still here.
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {interview.starts_at
            ? t("reschedule.whereWas", {
                company: interview.company_name,
                role: interview.role_title,
                when: formatDateTime(interview.starts_at),
              })
            : t("reschedule.where", { company: interview.company_name, role: interview.role_title })}
        </Text>
        {!noTimeYet && (
          <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
        )}
        <Checkbox
          label={t("needsNewTime.choice")}
          description={t("needsNewTime.choiceHint")}
          checked={noTimeYet}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setNoTimeYet(checked);
          }}
        />
        <Select
          label={t("reschedule.who")}
          required
          allowDeselect={false}
          data={WHO.map(({ value, key }) => ({ value, label: i18n.t(key) }))}
          value={who}
          error={whoMissing && !who ? t("reschedule.whoRequired") : undefined}
          onChange={(value) => setWho(value as RescheduleBy | null)}
        />
        <Textarea
          label={t("reschedule.why")}
          placeholder={t("reschedule.whyPlaceholder")}
          maxLength={500}
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setReason(value);
          }}
        />
        {noTimeYet && (
          <Stack gap="xs">
            <Checkbox
              label={t("needsNewTime.addTodo")}
              checked={addTodo}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setAddTodo(checked);
              }}
            />
            {addTodo && (
              <DateInput label={t("needsNewTime.todoDue")} value={due} onChange={setDue} clearable w={200} />
            )}
            <Text size="sm" c="dimmed">
              {t("needsNewTime.todoHint")}
            </Text>
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={noTimeYet ? false : !moved} loading={busy}>
            {noTimeYet ? t("needsNewTime.save") : t("reschedule.action")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
