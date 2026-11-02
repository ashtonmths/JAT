import { Anchor, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useHealth } from "./ApiStatus";
import classes from "./AppVersion.module.css";

/** The version this page was built from (frontend/package.json, set by the build). */
export const PAGE_VERSION = __APP_VERSION__;

const RELEASES = "https://github.com/waddington/job-application-tracker/releases/tag/v";

/**
 * Compare two "1.8.0" versions by number, part by part (so 1.10.0 is newer than 1.9.0).
 * Negative when a is older, positive when newer, 0 when the same; null if either isn't one.
 */
export function compareVersions(a: string, b: string): number | null {
  const parts = (v: string) => (/^\d+(\.\d+)*$/.test(v) ? v.split(".").map(Number) : null);
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The page's version in the menu's footer, linked to its release notes (a link only: nothing is
 * fetched from the web). When the running server is a different version, says so and what to do:
 * an older server needs restarting (the frontend was rebuilt under it); an older page needs a
 * refresh (the tab was opened before the server was updated).
 */
export function AppVersion({ page = PAGE_VERSION }: { page?: string }) {
  const { t } = useTranslation();
  const { data } = useHealth();
  // Nothing is said about the server until it has answered.
  const server = data?.version ? String(data.version) : page;
  const order = server === page ? 0 : compareVersions(server, page);
  // Versions that differ but can't be compared: restarting the server is the usual cure.
  const mismatch = order === 0 ? null : order !== null && order > 0 ? "pageOlder" : "serverOlder";

  return (
    <>
      <Anchor
        href={`${RELEASES}${page}`}
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
        c="dimmed"
        aria-label={t("version.linkLabel", { version: page })}
        title={t("version.linkLabel", { version: page })}
      >
        {t("version.short", { version: page })}
      </Anchor>
      <div role="status">
        {mismatch && (
          <Text size="xs" className={classes.mismatch}>
            {mismatch === "serverOlder"
              ? t("version.serverOlder", { server, page })
              : t("version.pageOlder", { server, page })}
          </Text>
        )}
      </div>
    </>
  );
}
