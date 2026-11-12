import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryState } from "./QueryState";

type Query = { data: string[] | undefined; isError: boolean; refetch: () => Promise<never> };

function renderState(query: Query, select?: (d: string[]) => string[]) {
  return render(
    <MantineProvider>
      <QueryState query={query} select={select} empty="Nothing here yet." rows={4}>
        {(list) => list.map((x) => <p key={x}>{x}</p>)}
      </QueryState>
    </MantineProvider>,
  );
}

const query = (q: Partial<Query>): Query => ({
  data: undefined,
  isError: false,
  refetch: vi.fn(),
  ...q,
});

describe("QueryState", () => {
  it("shows skeleton lines while loading, not the empty text", () => {
    renderState(query({}));
    const loading = screen.getByTestId("query-loading");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.children).toHaveLength(4);
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
  });

  it("says a failed load failed, and Retry refetches", () => {
    const q = query({ isError: true });
    renderState(q);
    expect(screen.getByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the empty text only for a list that loaded empty", () => {
    renderState(query({ data: [] }));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
  });

  it("shows the list, and keeps it through a failed refetch", () => {
    renderState(query({ data: ["Contoso", "Fabrikam"], isError: true }));
    expect(screen.getByText("Contoso")).toBeInTheDocument();
    expect(screen.getByText("Fabrikam")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("decides it's empty on the selected list", () => {
    renderState(query({ data: ["Contoso"] }), (d) => d.filter((x) => x !== "Contoso"));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});
