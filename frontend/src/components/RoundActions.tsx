import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Interview } from "../api/interviewHooks";
import { roundLabel } from "../utils/rounds";
import { InterviewFormModal } from "./InterviewFormModal";
import { InterviewOutcome } from "./OutcomeNotes";
import { RescheduleButton } from "./Reschedule";

/** Mark an open round done (or, once its time has passed, that it didn't happen), move a booked one
 * to another time, or edit it: on the Interviews page's rows and its calendar's round details. */
export function RoundActions({ interview }: { interview: Interview }) {
  const { t } = useTranslation("interviews");
  const [editing, setEditing] = useState(false);
  const label = roundLabel(interview);
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <InterviewOutcome interview={interview} />
      <RescheduleButton interview={interview} />
      <Tooltip label={t("edit")}>
        <ActionIcon variant="subtle" aria-label={t("editNamed", { label })} onClick={() => setEditing(true)}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
      {editing && (
        <InterviewFormModal
          opened
          onClose={() => setEditing(false)}
          applicationId={interview.application_id}
          interview={interview}
          nextRound={interview.round ?? 1}
        />
      )}
    </Group>
  );
}
