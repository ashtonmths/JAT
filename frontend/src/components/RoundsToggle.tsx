import { Switch, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useTranslation } from "react-i18next";

import type { Flow } from "../api/insightHooks";

/** Whether the Sankeys expand Interviewing into its rounds: off at first, remembered for both. */
export function useShowRounds() {
  return useLocalStorage<boolean>({
    key: "jat.insights.rounds",
    defaultValue: false,
    getInitialValueInEffect: false,
  });
}

/** The switch above a Sankey. */
export function RoundsToggle({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  const { t } = useTranslation("insights");
  return (
    <Switch
      label={t("rounds.toggle")}
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      size="xs"
    />
  );
}

/** With rounds on: what they mean, or, from a server that didn't expand them (an older one), why not. */
export function RoundsNote({ on, flow }: { on: boolean; flow?: Flow }) {
  const { t } = useTranslation("insights");
  if (!on || !flow) return null;
  return flow.rounds ? (
    <Text size="xs" c="dimmed" mb="sm">
      {t("rounds.hint")}
    </Text>
  ) : (
    <Text size="sm" c="orange" mb="sm">
      {t("rounds.olderServer")}
    </Text>
  );
}
