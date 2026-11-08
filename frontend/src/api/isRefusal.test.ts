import { expect, it } from "vitest";

import { ApiError, isRefusal } from "./client";

it("a coded refusal counts, so the page refreshes to show why", () => {
  expect(isRefusal(new ApiError({ detail: "still used", code: "company_has_applications" }))).toBe(true);
});

it("something already gone doesn't, nor an error with no answer from the server", () => {
  expect(isRefusal(new ApiError({ detail: "Company x not found", code: "company_not_found" }))).toBe(false);
  expect(isRefusal(new ApiError(null))).toBe(false);
  expect(isRefusal(new TypeError("Failed to fetch"))).toBe(false);
});
