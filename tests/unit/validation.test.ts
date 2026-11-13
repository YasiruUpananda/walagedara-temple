import { describe, it, expect } from "vitest";
import {
  adSchema,
  formatNumber,
  numberSchema,
  validateImage,
  friendlyError,
} from "../../src/lib/validation";
describe("appointment numbers", () => {
  it.each([
    [0, "000"],
    [1, "001"],
    [24, "024"],
    [999, "999"],
    [1000, "1000"],
    [9999, "9999"],
  ])("formats %i", (n, expected) =>
    expect(formatNumber(n as number)).toBe(expected),
  );
  it.each(["", " ", "-1", "1.5", "10000", "Infinity", "1e2", "NaN"])(
    "rejects %s",
    (v) => expect(numberSchema.safeParse(v).success).toBe(false),
  );
  it.each(["0", "24", "9999"])("accepts %s", (v) =>
    expect(numberSchema.safeParse(v).success).toBe(true),
  );
});
const ad = {
  title: "Notice",
  type: "text",
  heading: "Welcome",
  message: "Please wait",
  duration_seconds: 10,
  is_active: true,
};
describe("advertisement validation", () => {
  it("accepts a complete text advertisement", () =>
    expect(adSchema.safeParse(ad).success).toBe(true));
  it.each([
    { title: " " },
    { heading: "" },
    { message: "" },
    { duration_seconds: 2 },
    { duration_seconds: 121 },
    { duration_seconds: 3.5 },
    { title: "a".repeat(101) },
    { message: "a".repeat(501) },
  ])("rejects invalid fields %j", (fields) =>
    expect(adSchema.safeParse({ ...ad, ...fields }).success).toBe(false),
  );
  it("rejects unsupported and oversized files", () => {
    expect(() =>
      validateImage(new File(["x"], "x.svg", { type: "image/svg+xml" })),
    ).toThrow();
    expect(() =>
      validateImage(
        new File([new Uint8Array(5242881)], "x.png", { type: "image/png" }),
      ),
    ).toThrow();
  });
  it("does not expose database errors", () =>
    expect(friendlyError(new Error("secret SQL details"))).not.toContain(
      "SQL",
    ));
});
