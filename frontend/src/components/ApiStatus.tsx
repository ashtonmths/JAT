import { Group, Text, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface Health {
  status: string;
  version: string;
  schema: string | null;
  schema_head: string;
  git_repo: boolean;
  // Missing from a server older than 1.23.0 (one still running after an update).
  snapshots_enabled?: boolean;
  windows?: boolean;
}

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Health>;
}

/** The running server's health, checked every 30 seconds; shared by the dot and the version. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** A small connection indicator for the navbar footer. */
export function ApiStatus() {
  const { t } = useTranslation();
  const { data, isError, isPending } = useHealth();

  const snapshotsOn = data ? (data.snapshots_enabled ?? data.git_repo) : false;
  const versions = { version: String(data?.version), schema: data?.schema ?? "?" };

  const [color, label, detail] = isPending
    ? ["gray", t("api.connecting"), t("api.connectingHint")]
    : isError || !data
      ? ["red", t("api.offline"), t("api.offlineHint")]
      : [
          snapshotsOn ? "teal" : "yellow",
          t("api.connected"),
          snapshotsOn
            ? t("api.detailsBackups", versions)
            : data.git_repo && data.windows
              ? t("api.detailsWindowsNoSnapshots", versions)
              : t("api.detailsNoGit", versions),
        ];

  return (
    <Tooltip label={detail} position="top-start">
      <Group gap={6} wrap="nowrap" aria-live="polite">
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: `var(--mantine-color-${color}-6)`,
            display: "inline-block",
          }}
        />
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </Group>
    </Tooltip>
  );
}
