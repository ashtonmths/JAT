import { Button, Checkbox, Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useKeepCallOldTime,
  useMarkCallNeedsNewTime,
  useSaveMeeting,
  useUndoCallNeedsNewTime,
  type Meeting,
} from "../api/meetingHooks";
import { i18n } from "../i18n";
import { callLabel } from "../utils/calls";
import { formatDateTime } from "../utils/time";
import { useToday } from "../utils/useToday";
import { notifyMarked, WHO, wasText, type RescheduleBy } from "./Reschedule";

const PICKER = "YYYY-MM-DD HH:mm:ss";

/**
 * The Reschedule button and its dialog, for a booked call (its time may have passed); Set new time for one
 * waiting for a new time; nothing for any other. With onOpen, the button only asks for the dialog, which
 * the page hosts by the call's id (Today, where a refresh can move the row to another section).
 */
export function CallRescheduleButton({ meeting, onOpen }: { meeting: Meeting; onOpen?: () => void }) {
  const { t } = useTranslation("interviews");
  const [open, setOpen] = useState(false);
  if (meeting.status !== "scheduled") return null;
  const label = callLabel(meeting);
  const waiting = !!meeting.needs_new_time_since;
  return (
    <>
      <Button
        size="compact-xs"
        variant="light"
        color={waiting ? "red" : undefined}
        aria-label={waiting ? t("needsNewTime.setNamed", { label }) : t("reschedule.named", { label })}
        onClick={() => (onOpen ? onOpen() : setOpen(true))}
      >
        {waiting ? t("needsNewTime.setAction") : t("reschedule.action")}
      </Button>
      {open && <CallRescheduleDialog meeting={meeting} waiting={waiting} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A call's dialog: Set new time for one waiting for a new time (as it was when opened), Reschedule otherwise. */
export function CallRescheduleDialog({
  meeting,
  waiting,
  onClose,
}: {
  meeting: Meeting;
  waiting: boolean;
  onClose: () => void;
}) {
  return waiting ? (
    <CallSetNewTimeModal meeting={meeting} onClose={onClose} />
  ) : (
    <CallRescheduleModal meeting={meeting} onClose={onClose} />
  );
}

/**
 * Give a call waiting for a new time that time: the move from its old one, with the who and why it was
 * marked with, and its to-do ticked off (the API does both). Or it keeps its old time after all.
 */
function CallSetNewTimeModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "common"]);
  const save = useSaveMeeting();
  const keep = useKeepCallOldTime();
  const [when, setWhen] = useState<string | null>(null);
  const busy = save.isPending || keep.isPending;
  const moved = when !== null && !dayjs(when).isSame(dayjs(meeting.starts_at), "minute");
  return (
    <Modal
      opened
      onClose={onClose}
      title={t("needsNewTime.setNamed", { label: callLabel(meeting) })}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
    >
      <Stack>
        <Text size="sm">{wasText(meeting)}</Text>
        <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
        <Text size="sm" c="dimmed">
          {t("needsNewTime.setHint")}
        </Text>
        <Group justify="space-between">
          <Button
            variant="subtle"
            onClick={() => keep.mutate(meeting.id, { onSuccess: onClose })}
            disabled={busy}
          >
            {t("needsNewTime.keepOld")}
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={busy}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={() =>
                save.mutate(
                  { id: meeting.id, body: { starts_at: dayjs(when).toISOString() } },
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
 * Move a booked call to a new time, say who needed that and, if you like, why: the call keeps them with
 * the move. The API moves its end with it, so it lasts as long as before. Or, with no new time agreed
 * yet, mark it as needing one, with a to-do to book it made in the same request.
 */
function CallRescheduleModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "calls", "common"]);
  const save = useSaveMeeting();
  const mark = useMarkCallNeedsNewTime();
  const undo = useUndoCallNeedsNewTime();
  const [when, setWhen] = useState<string | null>(dayjs(meeting.starts_at).format(PICKER));
  const [who, setWho] = useState<RescheduleBy | null>(null);
  const [whoMissing, setWhoMissing] = useState(false);
  const [reason, setReason] = useState("");
  const [noTimeYet, setNoTimeYet] = useState(false);
  const [addTodo, setAddTodo] = useState(true);
  const today = useToday();
  const [due, setDue] = useState<string | null>(today);
  const busy = save.isPending || mark.isPending;
  const label = callLabel(meeting);
  // To the minute: a change of seconds or fractions alone is no move.
  const moved = when !== null && !dayjs(when).isSame(dayjs(meeting.starts_at), "minute");
  const submit = () => {
    if (!noTimeYet && !when) return;
    if (!who) {
      setWhoMissing(true);
      return;
    }
    if (noTimeYet) {
      // The to-do goes in this request, never made and then changed: Undo deletes it only if unchanged.
      const todo = addTodo ? { text: t("needsNewTime.todoText", { label }), due_on: due } : null;
      mark.mutate(
        { id: meeting.id, body: { by: who, reason: reason.trim() || null, todo } },
        {
          onSuccess: () => {
            onClose();
            notifyMarked(label, () => void undo(meeting.id));
          },
        },
      );
      return;
    }
    const body = {
      starts_at: dayjs(when).toISOString(),
      reschedule_by: who,
      reschedule_reason: reason.trim() || null,
    };
    save.mutate({ id: meeting.id, body }, { onSuccess: onClose });
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={t("reschedule.named", { label })}
      // While saving, nothing closes it: if the save fails, what you typed is still here.
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      withCloseButton={!busy}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t("calls:reschedule.was", { when: formatDateTime(meeting.starts_at) })}
        </Text>
        {!noTimeYet && (
          <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
        )}
        <Checkbox
          label={t("needsNewTime.choice")}
          description={t("calls:reschedule.choiceHint")}
          checked={noTimeYet}
          onChange={(e) => setNoTimeYet(e.currentTarget.checked)}
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
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        {noTimeYet ? (
          <Stack gap="xs">
            <Checkbox
              label={t("needsNewTime.addTodo")}
              checked={addTodo}
              onChange={(e) => setAddTodo(e.currentTarget.checked)}
            />
            {addTodo && (
              <DateInput label={t("needsNewTime.todoDue")} value={due} onChange={setDue} clearable w={200} />
            )}
            <Text size="sm" c="dimmed">
              {t("calls:reschedule.todoHint")}
            </Text>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            {t("calls:reschedule.hint")}
          </Text>
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
