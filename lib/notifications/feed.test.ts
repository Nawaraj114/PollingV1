import { describe, expect, it } from "vitest";

import { parseNotificationFeed } from "./feed";

describe("parseNotificationFeed", () => {
  it("normalizes a valid database notification", () => {
    expect(
      parseNotificationFeed([
        {
          action_count: 2,
          amount_minor: 12_345,
          created_at: "2026-07-23T12:00:00Z",
          href: "/bills?bill=bill-id",
          id: "confirm_receipt:bill-id",
          kind: "confirm_receipt",
          resource_id: "bill-id",
          resource_label: "Dinner",
        },
      ]),
    ).toEqual([
      {
        actionCount: 2,
        amountMinor: 12_345,
        createdAt: "2026-07-23T12:00:00Z",
        href: "/bills?bill=bill-id",
        id: "confirm_receipt:bill-id",
        kind: "confirm_receipt",
        resourceId: "bill-id",
        resourceLabel: "Dinner",
      },
    ]);
  });

  it("accepts numeric strings returned by JSON database clients", () => {
    const [notification] = parseNotificationFeed([
      {
        action_count: "1",
        amount_minor: "5000",
        created_at: "2026-07-23T12:00:00Z",
        href: "/polls#poll-id",
        id: "poll_vote:poll-id",
        kind: "poll_vote",
        resource_id: "poll-id",
        resource_label: "Where should we go?",
      },
    ]);

    expect(notification.actionCount).toBe(1);
    expect(notification.amountMinor).toBe(5000);
  });

  it.each([
    null,
    {},
    [{ kind: "unknown" }],
    [
      {
        action_count: 0,
        amount_minor: 0,
        created_at: "now",
        href: "https://example.com",
        id: "bad",
        kind: "poll_vote",
        resource_id: "poll-id",
        resource_label: "Question",
      },
    ],
  ])("drops malformed payloads", (payload) => {
    expect(parseNotificationFeed(payload)).toEqual([]);
  });
});
