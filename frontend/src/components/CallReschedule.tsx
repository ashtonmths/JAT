import { Button, Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSaveMeeting, type Meeting } from "../api/meetingHooks";
import { i18n } from "../i18n";
import { callLabel } from "../utils/calls";
import { formatDateTime } from "../utils/time";
import { WHO, type RescheduleBy } from "./Reschedule";

const PICKER = "YYYY-MM-DD HH:mm:ss";

/** The Reschedule button and its dialog, for a booked call (its time may have passed); nothing for any other. */
export function CallRescheduleButton({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation("interviews");
  const [open, setOpen] = useState(false);
  if (meeting.status !== "scheduled") return null;
  return (
    <>
      <Button
        size="compact-xs"
        variant="light"
        aria-label={t("reschedule.named", { label: callLabel(meeting) })}
        onClick={() => setOpen(true)}
      >
        {t("reschedule.action")}
      </Button>
      {open && <CallRescheduleModal meeting={meeting} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Move a booked call to a new time, say who needed that and, if you like, why: the call keeps them with
 * the move. The API moves its end with it, so it lasts as long as before.
 */
function CallRescheduleModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "calls", "common"]);
  const save = useSaveMeeting();
  const [when, setWhen] = useState<string | null>(dayjs(meeting.starts_at).format(PICKER));
  const [who, setWho] = useState<RescheduleBy | null>(null);
  const [whoMissing, setWhoMissing] = useState(false);
  const [reason, setReason] = useState("");
  // To the minute: a change of seconds or fractions alone is no move.
  const moved = when !== null && !dayjs(when).isSame(dayjs(meeting.starts_at), "minute");
  const submit = () => {
    if (!when) return;
    if (!who) {
      setWhoMissing(true);
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
      title={t("reschedule.named", { label: callLabel(meeting) })}
      // While saving, nothing closes it: if the save fails, what you typed is still here.
      closeOnEscape={!save.isPending}
      closeOnClickOutside={!save.isPending}
      withCloseButton={!save.isPending}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t("calls:reschedule.was", { when: formatDateTime(meeting.starts_at) })}
        </Text>
        <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
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
        <Text size="sm" c="dimmed">
          {t("calls:reschedule.hint")}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={!moved} loading={save.isPending}>
            {t("reschedule.action")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
