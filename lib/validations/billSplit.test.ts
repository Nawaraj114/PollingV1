import { describe, expect, it } from "vitest";

import {
  BillSplitError,
  calculateBillSplit,
  minorToDecimal,
  parseAmountToMinor,
} from "./billSplit";

describe("calculateBillSplit", () => {
  it("splits an all-blank bill evenly and assigns the rounding remainder deterministically", () => {
    expect(
      calculateBillSplit(10_000, [
        { participantId: "a" },
        { participantId: "b" },
        { participantId: "c" },
      ]),
    ).toEqual([
      { method: "automatic", owedMinor: 3334, participantId: "a" },
      { method: "automatic", owedMinor: 3333, participantId: "b" },
      { method: "automatic", owedMinor: 3333, participantId: "c" },
    ]);
  });

  it("splits the remainder between blank participants after explicit amounts", () => {
    expect(
      calculateBillSplit(10_000, [
        { exactMinor: 2500, participantId: "a" },
        { participantId: "b" },
        { participantId: "c" },
      ]),
    ).toEqual([
      { method: "explicit", owedMinor: 2500, participantId: "a" },
      { method: "automatic", owedMinor: 3750, participantId: "b" },
      { method: "automatic", owedMinor: 3750, participantId: "c" },
    ]);
  });

  it("assigns the complete remainder to one blank participant", () => {
    expect(
      calculateBillSplit(10_000, [
        { exactMinor: 7000, participantId: "a" },
        { participantId: "b" },
      ]),
    ).toEqual([
      { method: "explicit", owedMinor: 7000, participantId: "a" },
      { method: "automatic", owedMinor: 3000, participantId: "b" },
    ]);
  });

  it("handles repeating-cent rounding without losing or creating money", () => {
    const allocations = calculateBillSplit(
      100,
      ["a", "b", "c", "d", "e", "f"].map((participantId) => ({
        participantId,
      })),
    );

    expect(allocations.map((allocation) => allocation.owedMinor)).toEqual([
      17, 17, 17, 17, 16, 16,
    ]);
    expect(
      allocations.reduce((total, allocation) => total + allocation.owedMinor, 0),
    ).toBe(100);
  });

  it("uses a category breakdown as that participant's exact allocation", () => {
    expect(
      calculateBillSplit(5000, [
        {
          lineItems: [{ amountMinor: 1200 }, { amountMinor: 800 }],
          participantId: "a",
        },
        { participantId: "b" },
      ]),
    ).toEqual([
      { method: "breakdown", owedMinor: 2000, participantId: "a" },
      { method: "automatic", owedMinor: 3000, participantId: "b" },
    ]);
  });

  it("accepts all-explicit allocations only when they equal the bill total", () => {
    expect(
      calculateBillSplit(5000, [
        { exactMinor: 2000, participantId: "a" },
        { exactMinor: 3000, participantId: "b" },
      ]),
    ).toEqual([
      { method: "explicit", owedMinor: 2000, participantId: "a" },
      { method: "explicit", owedMinor: 3000, participantId: "b" },
    ]);
  });

  it.each([
    ["no participants", 1000, []],
    ["non-integer total", 10.5, [{ participantId: "a" }]],
    [
      "duplicate participants",
      1000,
      [{ participantId: "a" }, { participantId: "a" }],
    ],
    [
      "both exact and breakdown",
      1000,
      [
        {
          exactMinor: 500,
          lineItems: [{ amountMinor: 500 }],
          participantId: "a",
        },
      ],
    ],
    [
      "allocated amount over total",
      1000,
      [{ exactMinor: 1100, participantId: "a" }, { participantId: "b" }],
    ],
    [
      "all-explicit mismatch",
      1000,
      [
        { exactMinor: 400, participantId: "a" },
        { exactMinor: 500, participantId: "b" },
      ],
    ],
    ["zero exact amount", 1000, [{ exactMinor: 0, participantId: "a" }]],
  ])("rejects %s", (_label, total, participants) => {
    expect(() => calculateBillSplit(total, participants)).toThrow(BillSplitError);
  });
});

describe("currency conversion", () => {
  it.each([
    ["100", 10_000],
    ["100.1", 10_010],
    ["100.10", 10_010],
    ["0.01", 1],
    [" 42.50 ", 4250],
  ])("parses %s into integer minor units", (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each(["", "0", "-1", "1.001", "1,000", "abc"])(
    "rejects invalid amount %s",
    (input) => {
      expect(() => parseAmountToMinor(input)).toThrow(BillSplitError);
    },
  );

  it("formats minor units for exact Postgres numeric writes", () => {
    expect(minorToDecimal(10_010)).toBe("100.10");
    expect(minorToDecimal(1)).toBe("0.01");
  });
});
