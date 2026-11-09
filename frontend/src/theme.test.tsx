import { MantineProvider } from "@mantine/core";
import { DateInput, DatesProvider, DateTimePicker } from "@mantine/dates";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import dayjs from "dayjs";
import { theme, themeFor, typedDate } from "./theme";
import classes from "./theme.module.css";
import { dayjsLocale } from "./utils/format";

test.each([
  ["en", "5 Mar 2026", "5 Mar 2026 09:07"],
  ["zh-CN", "2026年3月5日", "2026年3月5日 09:07"],
])("date pickers write the date the %s way", (lang, day, dayTime) => {
  render(
    <MantineProvider theme={themeFor(lang)}>
      <DatesProvider settings={{ locale: dayjsLocale(lang) }}>
        <DateInput label="Day" defaultValue="2026-03-05" />
        <DateTimePicker label="At" defaultValue="2026-03-05 09:07:00" />
      </DatesProvider>
    </MantineProvider>,
  );
  expect(screen.getByLabelText("Day")).toHaveValue(day);
  expect(screen.getByLabelText("At")).toHaveTextContent(dayTime);
});

test("a date typed in Chinese is read", () => {
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("2026年3月5日")).toBe("2026-03-05");
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("2026-03-05")).toBe("2026-03-05");
  expect(typedDate("YYYY[年]M[月]D[日]", "zh-CN")("不是日期")).toBeNull();
});

test("a date typed in English is read exactly as before (dayjs and the browser alone)", () => {
  const before = (text: string) => (dayjs(text).isValid() ? dayjs(text).format("YYYY-MM-DD") : null);
  for (const text of [
    "5 Mar 2026",
    "05 Mar 2026",
    "2026-03-05",
    "March 5, 2026",
    "3/5/2026",
    "5 Mar",
    "nonsense",
    "",
  ]) {
    expect(typedDate("D MMM YYYY", "en")(text), text).toBe(before(text));
  }
});

test("typing a Chinese date into a date box keeps it", () => {
  let picked: string | null = null;
  render(
    <MantineProvider theme={themeFor("zh-CN")}>
      <DatesProvider settings={{ locale: dayjsLocale("zh-CN") }}>
        <DateInput label="Day" onChange={(v) => (picked = v)} />
      </DatesProvider>
    </MantineProvider>,
  );
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026年3月5日" } });
  expect(picked).toBe("2026-03-05");
});

test.each<[string, ReactNode]>([
  ["DateInput", <DateInput label="When" />],
  ["DateTimePicker", <DateTimePicker label="When" />],
  ["a picker with its own classNames", <DateInput label="When" classNames={{ input: "mine" }} />],
])("%s marks today", async (_name, picker) => {
  render(<MantineProvider theme={theme}>{picker}</MantineProvider>);
  fireEvent.click(screen.getByLabelText("When"));
  await waitFor(() => expect(document.querySelector("[data-today]")).not.toBeNull());
  const today = document.querySelector("[data-today]");
  expect(today).toHaveAttribute("data-highlight-today");
  expect(today).toHaveClass(String(classes.day));
});
