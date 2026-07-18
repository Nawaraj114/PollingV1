import { describe, expect, it } from "vitest";

import { createPollSchema, pollOptionsSchema, votePollSchema } from "./schemas";

describe("poll option validation", () => {
  it("accepts two unique trimmed options", () => {
    expect(pollOptionsSchema.parse(["  Pizza  ", "Momo"])).toEqual([
      "Pizza",
      "Momo",
    ]);
  });

  it("rejects case-insensitive duplicate options", () => {
    expect(pollOptionsSchema.safeParse(["Momo", " momo "]).success).toBe(false);
  });

  it("requires at least two options", () => {
    expect(pollOptionsSchema.safeParse(["Only choice"]).success).toBe(false);
  });

  it("rejects more than ten options", () => {
    expect(
      pollOptionsSchema.safeParse(
        Array.from({ length: 11 }, (_, index) => `Option ${index + 1}`),
      ).success,
    ).toBe(false);
  });
});

describe("poll action validation", () => {
  it("accepts an ISO expiry with an offset", () => {
    expect(
      createPollSchema.safeParse({
        allowsMultiple: "single",
        expiresAt: "2026-07-20T10:00:00.000Z",
        optionsJson: '["One","Two"]',
        question: "Which option should we choose?",
      }).success,
    ).toBe(true);
  });

  it("allows an optional blank expiry", () => {
    expect(
      createPollSchema.safeParse({
        allowsMultiple: "multiple",
        expiresAt: "",
        optionsJson: '["One","Two"]',
        question: "Which options work for everyone?",
      }).success,
    ).toBe(true);
  });

  it("requires at least one selected vote option", () => {
    expect(
      votePollSchema.safeParse({
        optionIds: [],
        pollId: "61720bdf-9bb7-4dc5-9d6c-7feea9131d22",
      }).success,
    ).toBe(false);
  });
});
