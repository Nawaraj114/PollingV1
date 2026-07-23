import { describe, expect, it } from "vitest";

import { simplifyBalances } from "./simplify";

describe("simplifyBalances", () => {
  it("reduces a multi-person chain to one transfer", () => {
    expect(
      simplifyBalances([
        { amountMinor: 2_000, creditorId: "b", debtorId: "a" },
        { amountMinor: 2_000, creditorId: "c", debtorId: "b" },
      ]),
    ).toEqual({
      memberBalances: [
        { memberId: "a", netMinor: -2_000 },
        { memberId: "c", netMinor: 2_000 },
      ],
      transfers: [{ amountMinor: 2_000, fromId: "a", toId: "c" }],
    });
  });

  it("nets reciprocal obligations before suggesting transfers", () => {
    expect(
      simplifyBalances([
        { amountMinor: 5_000, creditorId: "b", debtorId: "a" },
        { amountMinor: 3_000, creditorId: "a", debtorId: "b" },
      ]),
    ).toEqual({
      memberBalances: [
        { memberId: "a", netMinor: -2_000 },
        { memberId: "b", netMinor: 2_000 },
      ],
      transfers: [{ amountMinor: 2_000, fromId: "a", toId: "b" }],
    });
  });

  it("preserves every minor unit across multiple debtors and creditors", () => {
    const result = simplifyBalances([
      { amountMinor: 4_001, creditorId: "c", debtorId: "a" },
      { amountMinor: 1_999, creditorId: "d", debtorId: "a" },
      { amountMinor: 2_500, creditorId: "d", debtorId: "b" },
    ]);

    expect(result.transfers).toEqual([
      { amountMinor: 4_499, fromId: "a", toId: "d" },
      { amountMinor: 1_501, fromId: "a", toId: "c" },
      { amountMinor: 2_500, fromId: "b", toId: "c" },
    ]);
    expect(
      result.transfers.reduce(
        (total, transfer) => total + transfer.amountMinor,
        0,
      ),
    ).toBe(8_500);
  });

  it("returns an empty plan when the circle is square", () => {
    expect(simplifyBalances([])).toEqual({
      memberBalances: [],
      transfers: [],
    });
  });

  it.each([
    [{ amountMinor: 0, creditorId: "b", debtorId: "a" }],
    [{ amountMinor: 1.5, creditorId: "b", debtorId: "a" }],
    [{ amountMinor: 100, creditorId: "a", debtorId: "a" }],
    [{ amountMinor: 100, creditorId: "", debtorId: "a" }],
  ])("rejects invalid obligations", (obligation) => {
    expect(() => simplifyBalances([obligation])).toThrow();
  });
});
