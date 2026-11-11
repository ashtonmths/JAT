import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDraft } from "./useDraft";

type Fields = { applied_on: string | null; tags: string[] };
const start: Fields = { applied_on: null, tags: [] };

function setup(saved: Fields = start, id = "a1") {
  return renderHook(({ saved, id }) => useDraft(saved, id), { initialProps: { saved, id } });
}

describe("useDraft", () => {
  it("starts from the saved values, with nothing to save", () => {
    const { result } = setup();
    expect(result.current.values).toEqual(start);
    expect(result.current.dirty).toBe(false);
    expect(result.current.changes).toEqual({});
  });

  it("follows the server for a field not edited", () => {
    const { result, rerender } = setup();
    rerender({ saved: { applied_on: "2026-11-11", tags: [] }, id: "a1" });
    expect(result.current.values.applied_on).toBe("2026-11-11");
    expect(result.current.dirty).toBe(false);
  });

  it("keeps an edited field when the server changes, and Save gets only that field", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("tags", ["remote"]));
    rerender({ saved: { applied_on: "2026-11-11", tags: [] }, id: "a1" });
    expect(result.current.values).toEqual({ applied_on: "2026-11-11", tags: ["remote"] });
    expect(result.current.changes).toEqual({ tags: ["remote"] });
  });

  it("keeps an edit even when the server changes that same field", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("applied_on", "2026-01-02"));
    rerender({ saved: { applied_on: "2026-11-11", tags: [] }, id: "a1" });
    expect(result.current.values.applied_on).toBe("2026-01-02");
    expect(result.current.changes).toEqual({ applied_on: "2026-01-02" });
  });

  it("an edit set back to the saved value is nothing to save, and then follows the server", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("tags", ["x"]));
    act(() => result.current.set("tags", []));
    expect(result.current.dirty).toBe(false);
    rerender({ saved: { applied_on: null, tags: ["from elsewhere"] }, id: "a1" });
    expect(result.current.values.tags).toEqual(["from elsewhere"]);
    expect(result.current.dirty).toBe(false);
  });

  it("after a save it takes the stored value, then follows the server again", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("tags", [" remote "]));
    const sent = result.current.changes;
    act(() => result.current.saved(sent, { applied_on: null, tags: ["remote"] }));
    expect(result.current.values.tags).toEqual(["remote"]);
    rerender({ saved: { applied_on: null, tags: ["remote"] }, id: "a1" });
    expect(result.current.dirty).toBe(false);
    rerender({ saved: { applied_on: null, tags: ["later"] }, id: "a1" });
    expect(result.current.values.tags).toEqual(["later"]);
    expect(result.current.dirty).toBe(false);
  });

  it("a save doesn't overwrite what was typed while it was on its way", () => {
    const { result } = setup();
    act(() => result.current.set("tags", ["a"]));
    const sent = result.current.changes;
    act(() => result.current.set("tags", ["a", "b"]));
    act(() => result.current.saved(sent, { applied_on: null, tags: ["a"] }));
    expect(result.current.values.tags).toEqual(["a", "b"]);
  });

  it("a reply for the record shown before doesn't touch the next one's edits", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("tags", ["same"]));
    const { changes: sent, saved } = result.current;
    rerender({ saved: start, id: "a2" });
    act(() => result.current.set("tags", ["same"]));
    act(() => saved(sent, { applied_on: null, tags: ["tidied"] }));
    expect(result.current.values.tags).toEqual(["same"]);
  });

  it("starts again for another record", () => {
    const { result, rerender } = setup();
    act(() => result.current.set("tags", ["mine"]));
    rerender({ saved: start, id: "a2" });
    expect(result.current.values).toEqual(start);
    expect(result.current.dirty).toBe(false);
  });
});
