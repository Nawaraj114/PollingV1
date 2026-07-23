import type { Database, Json } from "@/types/database";

type PublicTables = Database["public"]["Tables"];

export type BillHistoryCsvSource = {
  bills: PublicTables["bills"]["Row"][];
  categories: PublicTables["bill_categories"]["Row"][];
  history: PublicTables["bill_status_history"]["Row"][];
  lineItems: PublicTables["bill_line_items"]["Row"][];
  participants: PublicTables["bill_participants"]["Row"][];
  profiles: PublicTables["profiles"]["Row"][];
  receipts: PublicTables["bill_receipts"]["Row"][];
  viewerId: string;
};

export type BillHistoryCsvPayload = Omit<
  BillHistoryCsvSource,
  "lineItems" | "viewerId"
> & {
  line_items: BillHistoryCsvSource["lineItems"];
};

const headers = [
  "bill_id",
  "bill_date",
  "bill_created_at",
  "description",
  "category",
  "bill_status",
  "bill_total_inr",
  "biller",
  "viewer_role",
  "allocation_id",
  "participant",
  "owed_amount_inr",
  "split_method",
  "auth_status",
  "auth_method",
  "authenticated_at",
  "dispute_note",
  "disputed_at",
  "payment_status",
  "marked_paid_at",
  "confirmed_at",
  "line_item_breakdown",
  "receipt_file",
  "receipt_attached_at",
  "bill_deleted_at",
  "event_type",
  "event_at",
  "event_actor",
  "event_details",
] as const;

function amount(value: number) {
  return Number(value).toFixed(2);
}

function json(value: Json) {
  return JSON.stringify(value);
}

export function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const spreadsheetSafe = /^[\t\r\n ]*[=+\-@]/u.test(text)
    ? `'${text}`
    : text;

  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export function buildBillHistoryCsv(source: BillHistoryCsvSource) {
  const categoryById = new Map(
    source.categories.map((category) => [category.id, category.name]),
  );
  const profileById = new Map(
    source.profiles.map((profile) => [profile.id, profile.full_name]),
  );
  const participantsByBill = Map.groupBy(
    source.participants,
    (participant) => participant.bill_id,
  );
  const historyByParticipant = Map.groupBy(
    source.history,
    (event) => event.bill_participant_id,
  );
  const lineItemsByParticipant = Map.groupBy(
    source.lineItems,
    (lineItem) => lineItem.bill_participant_id,
  );
  const receiptByBill = new Map(
    source.receipts.map((receipt) => [receipt.bill_id, receipt]),
  );
  const sortedBills = source.bills.toSorted(
    (left, right) =>
      right.incurred_on.localeCompare(left.incurred_on) ||
      right.created_at.localeCompare(left.created_at) ||
      left.id.localeCompare(right.id),
  );
  const rows: unknown[][] = [];

  for (const bill of sortedBills) {
    const billParticipants = (
      participantsByBill.get(bill.id) ?? [null]
    ).toSorted((left, right) => {
      if (!left || !right) return 0;
      return left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id);
    });
    const receipt = receiptByBill.get(bill.id);

    for (const participant of billParticipants) {
      const events = participant
        ? (historyByParticipant.get(participant.id) ?? [null]).toSorted(
            (left, right) => {
              if (!left || !right) return 0;
              return left.created_at.localeCompare(right.created_at) ||
                left.id.localeCompare(right.id);
            },
          )
        : [null];
      const breakdown = participant
        ? (lineItemsByParticipant.get(participant.id) ?? [])
            .toSorted(
              (left, right) =>
                (categoryById.get(left.category_id) ?? "").localeCompare(
                  categoryById.get(right.category_id) ?? "",
                ) || left.id.localeCompare(right.id),
            )
            .map(
              (lineItem) =>
                `${categoryById.get(lineItem.category_id) ?? "Category"}: ${amount(lineItem.amount)}`,
            )
            .join(" | ")
        : "";

      for (const event of events) {
        rows.push([
          bill.id,
          bill.incurred_on,
          bill.created_at,
          bill.description,
          categoryById.get(bill.category_id) ?? "Bill",
          bill.deleted_at ? "deleted" : bill.status,
          amount(bill.total_amount),
          profileById.get(bill.biller_id) ?? "Circle member",
          bill.biller_id === source.viewerId ? "biller" : "participant",
          participant?.id,
          participant
            ? profileById.get(participant.participant_id) ?? "Circle member"
            : "",
          participant ? amount(participant.owed_amount) : "",
          participant?.split_method,
          participant?.auth_status,
          participant?.auth_method,
          participant?.authenticated_at,
          participant?.dispute_note,
          participant?.disputed_at,
          participant?.payment_status,
          participant?.paid_at,
          participant?.confirmed_at,
          breakdown,
          receipt?.original_name,
          receipt?.created_at,
          bill.deleted_at,
          event?.event_type,
          event?.created_at,
          event
            ? profileById.get(event.actor_id) ?? "Circle member"
            : "",
          event ? json(event.event_data) : "",
        ]);
      }
    }
  }

  return `\uFEFF${[
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n")}\r\n`;
}
