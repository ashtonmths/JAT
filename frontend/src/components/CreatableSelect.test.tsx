import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import { CreatableSelect } from "./CreatableSelect";

const items = [
  { value: "ag1", label: "Northwind Talent" },
  { value: "ag2", label: "Contoso Recruiting" },
];

function Box({ onChange, start = "ag1" }: { onChange: (v: string | null) => void; start?: string | null }) {
  const [value, setValue] = useState<string | null>(start);
  return (
    <MantineProvider>
      <CreatableSelect
        label="Agency"
        placeholder="No agency"
        clearable
        items={items}
        value={value}
        onChange={(v) => {
          onChange(v);
          setValue(v);
        }}
        onCreate={() => Promise.resolve("new")}
      />
    </MantineProvider>
  );
}

const box = () => screen.getByPlaceholderText("No agency");

test("emptying the box takes the choice off, as the X does, and leaving it keeps it empty", () => {
  const onChange = vi.fn();
  render(<Box onChange={onChange} />);
  expect(box()).toHaveValue("Northwind Talent");
  box().focus();
  fireEvent.input(box(), { target: { value: "" } });
  expect(onChange).toHaveBeenCalledWith(null);
  fireEvent.blur(box());
  expect(box()).toHaveValue("");
});

test("a box holding only spaces counts as emptied", () => {
  const onChange = vi.fn();
  render(<Box onChange={onChange} />);
  box().focus();
  fireEvent.input(box(), { target: { value: "  " } });
  expect(onChange).toHaveBeenCalledWith(null);
});

test("changing the text without emptying it leaves the choice alone", () => {
  const onChange = vi.fn();
  render(<Box onChange={onChange} />);
  box().focus();
  fireEvent.input(box(), { target: { value: "Northwind" } });
  expect(onChange).not.toHaveBeenCalled();
});

test("an empty box with nothing chosen reports nothing", () => {
  const onChange = vi.fn();
  render(<Box onChange={onChange} start={null} />);
  box().focus();
  fireEvent.input(box(), { target: { value: "N" } });
  fireEvent.input(box(), { target: { value: "" } });
  expect(onChange).not.toHaveBeenCalled();
});

test("text written to the box while it hasn't focus (autofill, an extension) keeps the choice", () => {
  const onChange = vi.fn();
  render(<Box onChange={onChange} />);
  expect(document.activeElement).not.toBe(box());
  fireEvent.input(box(), { target: { value: "" } });
  expect(onChange).not.toHaveBeenCalled();
});
