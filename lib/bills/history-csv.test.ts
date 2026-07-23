import { describe, expect, it } from "vitest";

import type { BillHistoryCsvSource } from "./history-csv";
import { buildBillHistoryCsv, escapeCsvCell } from "./history-csv";

const source: BillHistoryCsvSource = {
  bills: [
    {
      biller_id: "biller",
      category_id: "food",
      created_at: "2026-07-20T10:00:00Z",
      deleted_at: null,
      deleted_by: null,
      description: 'Dinner, "drinks"\nand games',
      id: "bill-1",
      incurred_on: "2026-07-20",
      status: "settled",
      total_amount: 1200,
      updated_at: "2026-07-21T10:00:00Z",
    },
  ],
  categories: [
    {
      created_at: "2026-07-01T00:00:00Z",
      created_by: null,
      id: "food",
      name: "Food",
    },
  ],
  history: [
    {
      actor_id: "friend",
      bill_participant_id: "allocation-1",
      created_at: "2026-07-20T11:00:00Z",
      event_data: { auth_method: "password" },
      event_type: "authenticated",
      id: "event-2",
    },
    {
      actor_id: "biller",
      bill_participant_id: "allocation-1",
      created_at: "2026-07-20T10:00:00Z",
      event_data: { owed_amount: 400 },
      event_type: "created",
      id: "event-1",
    },
  ],
  lineItems: [
    {
      amount: 400,
      bill_participant_id: "allocation-1",
      category_id: "food",
      created_at: "2026-07-20T10:00:00Z",
      id: "line-1",
    },
  ],
  participants: [
    {
      auth_method: "password",
      auth_status: "authenticated",
      authenticated_at: "2026-07-20T11:00:00Z",
      bill_id: "bill-1",
      confirmed_at: "2026-07-21T10:00:00Z",
      created_at: "2026-07-20T10:00:00Z",
      dispute_note: null,
      disputed_at: null,
      id: "allocation-1",
      owed_amount: 400,
      paid_at: "2026-07-21T09:00:00Z",
      participant_id: "friend",
      payment_status: "confirmed_paid",
      split_method: "breakdown",
      updated_at: "2026-07-21T10:00:00Z",
    },
  ],
  profiles: [
    {
      avatar_path: null,
      created_at: "2026-07-01T00:00:00Z",
      full_name: "Bill Creator",
      id: "biller",
      is_admin: false,
      updated_at: "2026-07-01T00:00:00Z",
    },
    {
      avatar_path: null,
      created_at: "2026-07-01T00:00:00Z",
      full_name: "Friend",
      id: "friend",
      is_admin: false,
      updated_at: "2026-07-01T00:00:00Z",
    },
  ],
  receipts: [
    {
      bill_id: "bill-1",
      created_at: "2026-07-20T10:05:00Z",
      file_size: 1024,
      id: "receipt-1",
      mime_type: "image/jpeg",
      original_name: "receipt.jpg",
      storage_path: "private/path",
      uploaded_by: "biller",
    },
  ],
  viewerId: "friend",
};

describe("escapeCsvCell", () => {
  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('Dinner, "drinks"\nand games')).toBe(
      '"Dinner, ""drinks""\nand games"',
    );
  });

  it.each(["=2+2", " +SUM(A1:A2)", "\t@IMPORTXML(example)"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );
});

describe("buildBillHistoryCsv", () => {
  it("exports every audit event in chronological order with current bill context", () => {
    const csv = buildBillHistoryCsv(source);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"settled","1200.00","Bill Creator","participant"');
    expect(csv).toContain('"Food: 400.00","receipt.jpg"');
    const [, createdRow, authenticatedRow] = csv.split("\r\n");
    expect(createdRow).toContain('"created"');
    expect(authenticatedRow).toContain('"authenticated"');
    expect(csv.match(/"bill-1"/gu)).toHaveLength(2);
  });

  it("exports a header-only file when there is no visible bill history", () => {
    const csv = buildBillHistoryCsv({
      ...source,
      bills: [],
      history: [],
      lineItems: [],
      participants: [],
      receipts: [],
    });

    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain('"bill_id","bill_date"');
    expect(csv).not.toContain('"bill-1"');
  });

  it("labels soft-deleted bills as deleted", () => {
    const csv = buildBillHistoryCsv({
      ...source,
      bills: [{ ...source.bills[0], deleted_at: "2026-07-22T00:00:00Z" }],
    });

    expect(csv).toContain('"deleted","1200.00"');
  });
});
