import { Select, type SelectProps } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const NEW = "__new__";

/** Whether two names are the same one: ignoring capitals and spaces at either end, as the server does. */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * A searchable Select that can also add what you typed: when nothing matches, the list offers
 * `+ Add "<name>"`, which calls `onCreate` and selects the result.
 */
export function CreatableSelect({
  items,
  value,
  onChange,
  onCreate,
  onTypedChange,
  creating = false,
  ...props
}: Omit<SelectProps, "data" | "value" | "onChange" | "searchable"> & {
  items: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Create a new item called `name` and resolve to its id. */
  onCreate: (name: string) => Promise<string>;
  /**
   * Told the text in the box when it isn't the chosen item's name ("" when it is, or the box is
   * empty), so the form can save what was typed. Giving this also keeps that text in the box when
   * it loses focus, where Mantine would put back the chosen name.
   */
  onTypedChange?: (typed: string) => void;
  creating?: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const typed = search.trim();
  const exists = items.some((i) => sameName(i.label, typed));
  const data = typed && !exists ? [...items, { value: NEW, label: t("select.add", { name: typed }) }] : items;
  const chosen = items.find((i) => i.value === value)?.label;
  const unchosen = typed && !(chosen !== undefined && sameName(chosen, typed)) ? typed : "";
  useEffect(() => {
    onTypedChange?.(unchosen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unchosen]);
  return (
    <Select
      {...props}
      searchable
      data={data}
      value={value}
      searchValue={search}
      onSearchChange={setSearch}
      onBlur={(event) => {
        // Mantine has just reset the text; put back what was typed (clicking Save blurs the box first).
        if (onTypedChange && unchosen) setSearch(search);
        props.onBlur?.(event);
      }}
      disabled={props.disabled || creating}
      onChange={(next) => {
        if (next === NEW) {
          onCreate(typed)
            .then((id) => {
              setSearch("");
              onChange(id);
            })
            .catch(() => setSearch(typed)); // the error is shown; keep what was typed to try again
        } else {
          onChange(next);
        }
      }}
    />
  );
}
