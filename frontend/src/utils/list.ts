import { i18n } from "../i18n";

/** "Alex Morgan, Sam Patel" in English, "Alex Morgan、Sam Patel" in Chinese: a list the app
 *  builds, joined with the language's own separator (common:listSeparator), never a literal ", ".
 *  Call it while rendering, in a component that re-renders on a language change. */
export function joinList(items: readonly string[]): string {
  return items.join(i18n.t("common:listSeparator"));
}
