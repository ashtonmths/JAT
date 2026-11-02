import { Card, Loader, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useRejectionRounds, type RejectionRounds } from "../api/insightHooks";

// Whole keys, so the unused-key scanner sees them; a kind the app doesn't know reads as "other".
const AFTER_KIND = {
  screen: "rejectionRounds.afterKind.screen",
  hiring_manager: "rejectionRounds.afterKind.hiring_manager",
  technical: "rejectionRounds.afterKind.technical",
  coding_task: "rejectionRounds.afterKind.coding_task",
  system_design: "rejectionRounds.afterKind.system_design",
  pairing: "rejectionRounds.afterKind.pairing",
  behavioural: "rejectionRounds.afterKind.behavioural",
  onsite: "rejectionRounds.afterKind.onsite",
  final: "rejectionRounds.afterKind.final",
  other: "rejectionRounds.afterKind.other",
} as const;

const afterKind = (kind: string) =>
  AFTER_KIND[Object.hasOwn(AFTER_KIND, kind) ? (kind as keyof typeof AFTER_KIND) : "other"];

function Lines({ label, lines }: { label: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <Stack gap={2}>
      <Text size="sm" fw={600}>
        {label}
      </Text>
      <Stack gap={2} component="ul" aria-label={label} p={0} m={0} style={{ listStyle: "none" }}>
        {lines.map((line) => (
          <Text key={line} size="sm" component="li">
            {line}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}

function Counts({ data }: { data: RejectionRounds }) {
  const { t } = useTranslation("insights");
  const count = data.rejections;
  const byKind = data.by_kind.map((k) => t(afterKind(k.kind), { count, n: k.count }));
  const byNumber = [
    ...data.by_number.map((r) => t("rejectionRounds.afterRound", { count, n: r.count, round: r.round })),
    ...(data.unnumbered ? [t("rejectionRounds.unnumbered", { count, n: data.unnumbered })] : []),
  ];
  return (
    <Stack gap="sm">
      <Text size="sm">
        {t("rejectionRounds.total", { count })}
        {data.no_rounds > 0 && ` ${t("rejectionRounds.noRounds", { count, n: data.no_rounds })}`}
      </Text>
      <Lines label={t("rejectionRounds.byKind")} lines={byKind} />
      <Lines label={t("rejectionRounds.byNumber")} lines={byNumber} />
      <Text size="sm" c="dimmed">
        {t("rejectionRounds.hint")}
      </Text>
    </Stack>
  );
}

/** Which round rejections came after ("do I keep getting rejected after coding?"): counts only, no rates. */
export function RejectionRoundsCard({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const { data, isLoading, isError } = useRejectionRounds(since);
  return (
    <Card withBorder>
      <Title order={4}>{t("rejectionRounds.heading")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t(since ? "rejectionRounds.introPeriod" : "rejectionRounds.intro")}
      </Text>
      {isLoading ? (
        <Loader />
      ) : isError || !data ? (
        <Text c="red">{t("rejectionRounds.loadFailed")}</Text>
      ) : !data.rejections ? (
        <Text size="sm" c="dimmed">
          {t(since ? "rejectionRounds.noneInPeriod" : "rejectionRounds.none")}
        </Text>
      ) : (
        <Counts data={data} />
      )}
    </Card>
  );
}
