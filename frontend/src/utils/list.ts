import { i18n } from "../i18n";

/** "Alex Morgan, Sam Patel" in English, "Alex Morgan、Sam Patel" in Chinese: a list the app
 *  builds, joined with the language's own separator (common:listSeparator), never a literal ", ".
 *  Call it while rendering, in a component that re-renders on a language change. */
export function joinList(items: readonly string[]): string {
  return items.join(i18n.t("common:listSeparator"));
}

/** Whole sentences the app shows one after another: "Was Tue 3 Nov. Set the new time…" in
 *  English, with no space after 。 in Chinese (common:twoSentences, applied pair by pair). Empty
 *  ones are left out, so an optional sentence can be passed as "" or skipped with a condition.
 *  Call it while rendering, like joinList. */
export function joinSentences(...sentences: readonly (string | false | null | undefined)[]): string {
  const shown = sentences.filter((s): s is string => !!s);
  if (!shown.length) return "";
  return shown.reduce((first, second) => i18n.t("common:twoSentences", { first, second }));
}
