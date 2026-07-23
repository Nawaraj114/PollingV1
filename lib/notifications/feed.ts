export type ActionNotificationKind =
  | "allocation_review"
  | "confirm_receipt"
  | "dispute_resolution"
  | "payment_due"
  | "poll_vote";

export type ActionNotification = {
  actionCount: number;
  amountMinor: number;
  createdAt: string;
  href: string;
  id: string;
  kind: ActionNotificationKind;
  resourceId: string;
  resourceLabel: string;
};

const notificationKinds = new Set<ActionNotificationKind>([
  "allocation_review",
  "confirm_receipt",
  "dispute_resolution",
  "payment_due",
  "poll_vote",
]);

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nonNegativeInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function parseNotificationFeed(value: unknown): ActionNotification[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];

    const item = entry as Record<string, unknown>;
    const id = text(item.id);
    const kind = text(item.kind) as ActionNotificationKind;
    const createdAt = text(item.created_at);
    const resourceId = text(item.resource_id);
    const resourceLabel = text(item.resource_label);
    const href = text(item.href);
    const amountMinor = nonNegativeInteger(item.amount_minor);
    const actionCount = nonNegativeInteger(item.action_count);

    if (
      !id ||
      !notificationKinds.has(kind) ||
      !createdAt ||
      !resourceId ||
      !resourceLabel ||
      !href.startsWith("/") ||
      amountMinor === null ||
      actionCount === null ||
      actionCount < 1
    ) {
      return [];
    }

    return [
      {
        actionCount,
        amountMinor,
        createdAt,
        href,
        id,
        kind,
        resourceId,
        resourceLabel,
      },
    ];
  });
}
