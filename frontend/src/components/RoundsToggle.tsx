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

/**
 * With rounds on: what they mean, or, from a server that can't expand them (an older one, which
 * sends no `rounds` at all), why not. Nothing while the last answer stands in for the next one
 * (`placeholder`): that's the flow from before the switch was turned on.
 */
export function RoundsNote({ on, flow, placeholder }: { on: boolean; flow?: Flow; placeholder: boolean }) {
  const { t } = useTranslation("insights");
  if (!on || !flow || placeholder) return null;
  if (flow.rounds)
    return (
      <Text size="xs" c="dimmed" mb="sm">
        {t("rounds.hint")}
      </Text>
    );
  if (flow.rounds === undefined)
    return (
      <Text size="sm" c="orange" mb="sm">
        {t("rounds.olderServer")}
      </Text>
    );
  return null;
}
