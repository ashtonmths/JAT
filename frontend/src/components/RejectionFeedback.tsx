import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ApplicationDetail } from "../api/client";
import { useMoveApplication, useSetRejectionFeedback, type MoveArgs } from "../api/hooks";
import { stageName } from "../utils/stageName";

/** The stage that takes feedback, by its id (the server's `workflow.REJECTED`): rename it and it still does. */
export const REJECTED = "rejected";

/** The feedback part of a move's body. Sent when there's text, or to clear feedback the application
 * already has (so emptying the filled-in text clears it); otherwise left out, so an older server, which
 * has no feedback and refuses fields it doesn't know, still takes the move. Kept as written. */
export function feedbackField(
  text: string,
  existing: string | null | undefined,
): { rejection_feedback?: string } {
  if (text.trim()) return { rejection_feedback: text };
  return (existing ?? null) !== null ? { rejection_feedback: "" } : {};
}

/** Asking for the feedback. Nothing saves until you confirm, and while saving it can't close (as with
 * How did it go?): if the save fails, what you typed is still here. */
function FeedbackModal({
  title,
  subtitle,
  initial,
  confirm,
  loading,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  initial: string | null | undefined;
  confirm: string;
  loading: boolean;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(["applications", "common"]);
  const [text, setText] = useState(initial ?? "");
  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      size="lg"
      closeOnEscape={!loading}
      closeOnClickOutside={!loading}
      withCloseButton={!loading}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {subtitle}
        </Text>
        <Textarea
          label={t("rejection.label")}
          description={t("rejection.description")}
          placeholder={t("rejection.placeholder")}
          autosize
          minRows={4}
          maxRows={14}
          maxLength={10000}
          data-autofocus
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            {t("common:actions.cancel")}
          </Button>
          <Button loading={loading} onClick={() => onSave(text)}>
            {confirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type AppLike = Pick<ApplicationDetail, "company_name" | "role_title" | "rejection_feedback">;
type Asking = { args: MoveArgs; existing: string | null | undefined; where: string; onMoved?: () => void };

/**
 * Moving an application, with a stop on the way to Rejected to ask what they said. Cancelling there
 * cancels the move; leaving it empty moves it without feedback. Render `dialog` somewhere.
 */
export function useMoveAsking(): {
  request: (args: MoveArgs, app: AppLike, onMoved?: () => void) => void;
  dialog: ReactNode;
  isPending: boolean;
} {
  const { t } = useTranslation("applications");
  const move = useMoveApplication();
  const [asking, setAsking] = useState<Asking | null>(null);
  const request = (args: MoveArgs, app: AppLike, onMoved?: () => void) => {
    if (args.to_stage !== REJECTED) {
      move.mutate(args);
      onMoved?.();
      return;
    }
    const where = t("rejection.where", { company: app.company_name, role: app.role_title });
    setAsking({ args, existing: app.rejection_feedback, where, onMoved });
  };
  // As the stage shows everywhere else: a default one in your language, one you renamed as you wrote it.
  const stage = stageName({ id: REJECTED, name: asking?.args.stageName ?? REJECTED });
  const dialog = asking && (
    <FeedbackModal
      title={t("rejection.moveTitle", { stage })}
      subtitle={asking.where}
      initial={asking.existing}
      confirm={t("rejection.moveConfirm", { stage })}
      loading={move.isPending}
      onClose={() => setAsking(null)}
      onSave={(text) =>
        move.mutate(
          { ...asking.args, ...feedbackField(text, asking.existing) },
          {
            onSuccess: () => {
              asking.onMoved?.();
              setAsking(null);
            },
          },
        )
      }
    />
  );
  return { request, dialog, isPending: move.isPending };
}

/** The feedback on the application page and quick view, as written, with Add or Edit. Shown once it's
 * been rejected, or while there's feedback (kept through an undo or reopening). */
export function RejectionFeedback({ app }: { app: ApplicationDetail }) {
  const { t } = useTranslation("applications");
  const save = useSetRejectionFeedback();
  const [editing, setEditing] = useState(false);
  const feedback = app.rejection_feedback ?? null;
  if (app.stage !== REJECTED && feedback === null) return null;
  return (
    <Stack gap={4}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text size="sm" fw={700}>
          {t("rejection.heading")}
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          leftSection={<IconPencil size={12} />}
          onClick={() => setEditing(true)}
        >
          {feedback === null ? t("rejection.add") : t("rejection.edit")}
        </Button>
      </Group>
      {feedback === null ? (
        <Text size="sm" c="dimmed">
          {t("rejection.none")}
        </Text>
      ) : (
        <Text
          size="sm"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          data-testid="rejection-feedback"
        >
          {feedback}
        </Text>
      )}
      {editing && (
        <FeedbackModal
          title={feedback === null ? t("rejection.addTitle") : t("rejection.editTitle")}
          subtitle={t("rejection.where", { company: app.company_name, role: app.role_title })}
          initial={feedback}
          confirm={t("rejection.save")}
          loading={save.isPending}
          onClose={() => setEditing(false)}
          onSave={(text) =>
            save.mutate(
              { id: app.id, feedback: text.trim() ? text : null },
              { onSuccess: () => setEditing(false) },
            )
          }
        />
      )}
    </Stack>
  );
}
