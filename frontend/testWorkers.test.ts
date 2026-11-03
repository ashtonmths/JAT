import { describe, expect, it } from "vitest";
import { testWorkers } from "./testWorkers";

describe("testWorkers", () => {
  it("uses a quarter of the cores", () => {
    expect(testWorkers({}, 12)).toBe(3);
    expect(testWorkers({}, 16)).toBe(4);
  });

  it("never goes below one", () => {
    expect(testWorkers({}, 2)).toBe(1);
    expect(testWorkers({}, 1)).toBe(1);
  });

  it("takes TEST_WORKERS when it's a positive whole number", () => {
    expect(testWorkers({ TEST_WORKERS: "6" }, 12)).toBe(6);
    expect(testWorkers({ TEST_WORKERS: "0" }, 12)).toBe(3);
    expect(testWorkers({ TEST_WORKERS: "lots" }, 12)).toBe(3);
  });
});
