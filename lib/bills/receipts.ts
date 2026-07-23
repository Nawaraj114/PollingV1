import { createClient } from "../supabase/client";

const receiptTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);

export const receiptAccept = "image/jpeg,image/png,image/webp";
export const maxReceiptBytes = 5 * 1024 * 1024;

export function validateReceiptFile(file: File) {
  if (
    !receiptTypes.has(
      file.type as "image/jpeg" | "image/png" | "image/webp",
    )
  ) {
    return "Choose a JPG, PNG, or WebP receipt image.";
  }

  if (file.size < 1 || file.size > maxReceiptBytes) {
    return "Receipt images must be 5 MB or smaller.";
  }

  return null;
}

export async function attachBillReceipt({
  billId,
  file,
  viewerId,
}: {
  billId: string;
  file: File;
  viewerId: string;
}) {
  const validationError = validateReceiptFile(file);
  if (validationError) return validationError;

  const extension = receiptTypes.get(
    file.type as "image/jpeg" | "image/png" | "image/webp",
  )!;
  const supabase = createClient();
  const storagePath = `${viewerId}/${billId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("bill-receipts")
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return "The receipt could not be uploaded. Try another image.";
  }

  const originalName =
    file.name.trim().slice(0, 120) || `receipt.${extension}`;
  const { error: metadataError } = await supabase
    .from("bill_receipts")
    .insert({
      bill_id: billId,
      file_size: file.size,
      mime_type: file.type as "image/jpeg" | "image/png" | "image/webp",
      original_name: originalName,
      storage_path: storagePath,
      uploaded_by: viewerId,
    });

  if (metadataError) {
    await supabase.storage.from("bill-receipts").remove([storagePath]);
    return "Receipt details could not be saved. Refresh and try again.";
  }

  return null;
}
