import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { RecruiterLine } from "./RecruiterLine";

const person = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  title: null,
  agency_id: null,
  company_id: null,
  details: [],
  closed_as: null,
  favourite: false,
  created_at: "",
  updated_at: "",
  ...overrides,
});

function renderLine(node: ReactNode) {
  mockApi({
    "/api/v1/contacts": [
      person("c1", "Alex Morgan"),
      person("c2", "Riley Chen", { closed_as: "ghosted" }),
      person("c3", "Sam Patel", { favourite: true }),
    ],
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <p data-testid="line">{node}</p> }),
    history: createMemoryHistory(),
  });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("RecruiterLine", () => {
  it("adds the recruiter after the line, linked to their page", async () => {
    renderLine(
      <RecruiterLine id="c1" name="Alex Morgan">
        Contoso · Backend Engineer
      </RecruiterLine>,
    );
    const link = await screen.findByRole("link", { name: "Alex Morgan" });
    expect(link).toHaveAttribute("href", "/people/c1");
    // Dimmed and underlined, so it doesn't read as part of a blue "Company · Role" link before it.
    expect(link).toHaveStyle({ color: "var(--mantine-color-dimmed)" });
    expect(screen.getByTestId("line")).toHaveTextContent(/^Contoso · Backend Engineer · Alex Morgan$/);
  });

  it("marks someone who ghosted you", async () => {
    renderLine(
      <RecruiterLine id="c2" name="Riley Chen">
        Contoso
      </RecruiterLine>,
    );
    expect(await screen.findByRole("img", { name: "Ghosted" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Riley Chen" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Favourite" })).toBeNull();
  });

  it("stars a favourite", async () => {
    renderLine(
      <RecruiterLine id="c3" name="Sam Patel">
        Contoso
      </RecruiterLine>,
    );
    expect(await screen.findByRole("img", { name: "Favourite" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Ghosted" })).toBeNull();
  });

  it("shows only the line when there's no recruiter, or an older server doesn't say", async () => {
    renderLine(
      <>
        <RecruiterLine id={null} name={null}>
          Contoso · Backend Engineer
        </RecruiterLine>
        <RecruiterLine id={undefined} name={undefined}>
          {" "}
          and more
        </RecruiterLine>
      </>,
    );
    expect(await screen.findByTestId("line")).toHaveTextContent(/^Contoso · Backend Engineer and more$/);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("can leave the name unlinked, inside a row that opens on click", async () => {
    renderLine(
      <RecruiterLine id="c1" name="Alex Morgan" link={false}>
        Direct
      </RecruiterLine>,
    );
    expect(await screen.findByTestId("line")).toHaveTextContent(/^Direct · Alex Morgan$/);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
