import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteSummary } from "../api/noteHooks";
import { mockApi } from "../test/mockApi";
import { NotesList } from "./Notes";

const summary = {
  id: "n1",
  title: "Pinned note",
  links: [],
  path: "notes/pinned-note.md",
  excerpt: "First",
  created_at: "2026-01-05T10:00:00Z",
  updated_at: "2026-01-05T10:00:00Z",
} satisfies NoteSummary;

afterEach(() => vi.unstubAllGlobals());

describe("editing a note", () => {
  it("checks for changes against the version the form was filled from, even after a refetch", async () => {
    let gets = 0;
    const calls = mockApi({
      // The first read is what the form fills from; the refetch brings a change made elsewhere.
      "GET /api/v1/notes/n1": () =>
        ++gets === 1
          ? { ...summary, body: "First" }
          : { ...summary, body: "From elsewhere", updated_at: "2026-01-05T11:00:00Z" },
      "PATCH /api/v1/notes/n1": { ...summary, body: "Mine", updated_at: "2026-01-05T12:00:00Z" },
      "/api/v1/applications": [],
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MantineProvider>
        <QueryClientProvider client={qc}>
          <NotesList notes={[summary]} empty="" />
        </QueryClientProvider>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Pinned note" }));
    const text = await screen.findByRole("textbox", { name: "Note" });
    expect(text).toHaveValue("First");

    // The refetch, and the re-render it schedules, land under the open form.
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["note", "n1"] });
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(gets).toBe(2);
    expect(text).toHaveValue("First"); // an open form isn't re-synced
    fireEvent.change(text, { target: { value: "Mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({
        body: "Mine",
        base_updated_at: "2026-01-05T10:00:00Z",
      }),
    );
  });
});
