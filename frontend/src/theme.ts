import { createTheme } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import { FALLBACK } from "./i18n/language";
import classes from "./theme.module.css";
import { datePattern } from "./utils/format";

// Every date picker marks today (classNames here merge with any a picker passes itself), and
// writes its date the way the rest of the app does in your language ("31 Oct 2026" in English),
// not Mantine's American "October 31, 2026". A typed date is read with the same pattern.
const today = { defaultProps: { highlightToday: true }, classNames: { day: classes.day } };

/** The app's theme for a language (only the date pickers' pattern differs between languages). */
export function themeFor(lang: string) {
  const picker = (valueFormat: string) => ({
    ...today,
    defaultProps: { ...today.defaultProps, valueFormat },
  });
  return createTheme({
    primaryColor: "indigo",
    defaultRadius: "md",
    // The Chinese fonts come last: Latin letters are always found in the fonts before them, so
    // English looks the same, and Chinese gets each system's Simplified Chinese font (macOS,
    // Windows, Linux) rather than whatever the browser falls back to. A future Japanese or
    // Korean translation would need its own fonts ahead of these, for its own glyph shapes.
    fontFamily:
      'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif',
    headings: { fontWeight: "650" },
    components: {
      DateInput: DateInput.extend(picker(datePattern("pickerDate", lang))),
      DateTimePicker: DateTimePicker.extend(picker(datePattern("pickerDateTime", lang))),
    },
  });
}

/** The English theme. */
export const theme = themeFor(FALLBACK);
