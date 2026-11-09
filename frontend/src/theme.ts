import { createTheme } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { FALLBACK } from "./i18n/language";
import classes from "./theme.module.css";
import { datePattern, dayjsLocale } from "./utils/format";

dayjs.extend(customParseFormat);

// Every date picker marks today (classNames here merge with any a picker passes itself), and
// writes its date the way the rest of the app does in your language ("31 Oct 2026" in English),
// not Mantine's American "October 31, 2026".
const today = { defaultProps: { highlightToday: true }, classNames: { day: classes.day } };

/**
 * Reads a date typed into a date box: first exactly as the box writes it ("2026年3月5日", "5 Mar
 * 2026"), then as before this existed, whatever dayjs and the browser make of it ("2026-03-05",
 * "March 5, 2026"). So English reads typed dates as it always did, and Chinese can be typed too.
 */
export const typedDate =
  (pattern: string, lang: string) =>
  (text: string): string | null => {
    const exact = dayjs(text, pattern, dayjsLocale(lang), true);
    const day = exact.isValid() ? exact : dayjs(text);
    return day.isValid() ? day.format("YYYY-MM-DD") : null;
  };

/** The app's theme for a language (only the date pickers' pattern differs between languages). */
export function themeFor(lang: string) {
  const pickerDate = datePattern("pickerDate", lang);
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
      DateInput: DateInput.extend({
        ...today,
        defaultProps: {
          ...today.defaultProps,
          valueFormat: pickerDate,
          dateParser: typedDate(pickerDate, lang),
        },
      }),
      DateTimePicker: DateTimePicker.extend({
        ...today,
        defaultProps: { ...today.defaultProps, valueFormat: datePattern("pickerDateTime", lang) },
      }),
    },
  });
}

/** The English theme. */
export const theme = themeFor(FALLBACK);
