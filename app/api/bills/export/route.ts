import {
  buildBillHistoryCsv,
  type BillHistoryCsvPayload,
} from "@/lib/bills/history-csv";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function textResponse(message: string, status: number) {
  return new Response(message, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
    status,
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub;

  if (claimsError || !viewerId) {
    return textResponse("Authentication is required.", 401);
  }

  const { data, error } = await supabase.rpc("get_bill_history_export");

  if (error || !data) {
    console.error("Bill history CSV export failed", {
      code: error?.code,
    });
    return textResponse("Bill history could not be exported.", 500);
  }

  const payload = data as unknown as BillHistoryCsvPayload;
  const csv = buildBillHistoryCsv({
    bills: payload.bills ?? [],
    categories: payload.categories ?? [],
    history: payload.history ?? [],
    lineItems: payload.line_items ?? [],
    participants: payload.participants ?? [],
    profiles: payload.profiles ?? [],
    receipts: payload.receipts ?? [],
    viewerId,
  });
  const filename = `friendcircle-bill-history-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
