import {
  ActionIcon,
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCalendarEvent, IconPencil } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useInterviews, type Interview } from "../api/interviewHooks";
import { InterviewFormModal } from "../components/InterviewFormModal";
import { InterviewOutcome } from "../components/OutcomeNotes";
import { roundStatus } from "../components/Interviews";
import { RescheduleButton, RescheduledBadge, wasText } from "../components/Reschedule";
import { RecruiterLine } from "../components/RecruiterLine";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";

/** Mark a booked round done (or that it didn't happen), move it to another time, or edit it. */
function RoundActions({ interview }: { interview: Interview }) {
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

function InterviewTable({ interviews, empty }: { interviews: Interview[]; empty: string }) {
  const { t } = useTranslation("interviews");
  if (!interviews.length) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  }
  return (
    // On a phone the row is wider than the card: it scrolls sideways, so its buttons can be reached.
    <Table.ScrollContainer minWidth={640}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("page.when")}</Table.Th>
            <Table.Th>{t("page.round")}</Table.Th>
            <Table.Th>{t("page.application")}</Table.Th>
            <Table.Th>{t("page.status")}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {interviews.map((i) => {
            const when = i.starts_at ?? i.deadline_at;
            return (
              <Table.Tr key={i.id}>
                <Table.Td>
                  <Text size="sm">
                    {i.needs_new_time_since
                      ? wasText(i)
                      : !when
                        ? t("notBooked")
                        : i.starts_at
                          ? formatDateTime(when)
                          : t("due", { when: formatDateTime(when) })}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {roundLabel(i)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Anchor component={Link} to={`/applications/${i.application_id}`} size="sm">
                    {i.company_name}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    <RecruiterLine id={i.recruiter_id} name={i.recruiter_name}>
                      {i.role_title}
                    </RecruiterLine>
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Badge size="sm" variant="light" color={roundStatus(i).color}>
                      {roundStatus(i).label}
                    </Badge>
                    <RescheduledBadge interview={i} />
                  </Group>
                </Table.Td>
                <Table.Td>
                  <RoundActions interview={i} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Every interview round across applications: what's coming up, then everything else, newest first. */
export function InterviewsPage() {
  const { t } = useTranslation("interviews");
  // "Upcoming" starts at your local midnight, so this morning's interview still counts today.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const upcomingQuery = useInterviews({ upcoming: true, since: midnight.toISOString() });
  const allQuery = useInterviews({});
  const isLoading = upcomingQuery.isLoading || allQuery.isLoading;
  const upcoming = upcomingQuery.data;
  const upcomingIds = new Set((upcoming ?? []).map((i) => i.id));
  // Waiting for a new time: on top, since it's yours to sort out. Their old time isn't coming up.
  const waiting = (allQuery.data ?? []).filter((i) => i.status === "scheduled" && i.needs_new_time_since);
  const rest = (allQuery.data ?? []).filter((i) => !upcomingIds.has(i.id) && !waiting.includes(i)).reverse();

  return (
    <Stack maw={1100}>
      <Group gap="sm">
        <IconCalendarEvent size={26} stroke={1.6} />
        <Title order={2}>{t("page.title")}</Title>
      </Group>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {waiting.length > 0 && (
            <Card withBorder>
              <Title order={4} mb="sm">
                {t("page.needsNewTime")}
              </Title>
              <InterviewTable interviews={waiting} empty="" />
            </Card>
          )}
          <Card withBorder>
            <Title order={4} mb="sm">
              {t("page.comingUp")}
            </Title>
            <InterviewTable interviews={upcoming ?? []} empty={t("page.comingUpEmpty")} />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              {t("page.earlier")}
            </Title>
            <InterviewTable interviews={rest} empty={t("page.earlierEmpty")} />
          </Card>
        </>
      )}
    </Stack>
  );
}
