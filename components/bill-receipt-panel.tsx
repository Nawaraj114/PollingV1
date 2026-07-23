"use client";

import {
  Camera,
  ExternalLink,
  FileImage,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const receiptTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
] as const);
const maxReceiptBytes = 5 * 1024 * 1024;

type Receipt = {
  createdAt: string;
  id: string;
  originalName: string;
  signedUrl: string | null;
  storagePath: string;
  uploaderName: string;
};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

export function BillReceiptPanel({
  billId,
  canManage,
  receipt,
  viewerId,
}: {
  billId: string;
  canManage: boolean;
  receipt: Receipt | null;
  viewerId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    status: "error" | "success";
    text: string;
  } | null>(null);

  async function uploadReceipt() {
    const file = inputRef.current?.files?.[0];

    if (!file) {
      setMessage({ status: "error", text: "Choose a receipt photo first." });
      return;
    }

    const extension = receiptTypes.get(
      file.type as "image/jpeg" | "image/png" | "image/webp",
    );

    if (!extension) {
      setMessage({
        status: "error",
        text: "Choose a JPG, PNG, or WebP receipt image.",
      });
      return;
    }

    if (file.size < 1 || file.size > maxReceiptBytes) {
      setMessage({
        status: "error",
        text: "Receipt images must be 5 MB or smaller.",
      });
      return;
    }

    setPending(true);
    setMessage(null);

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
      setPending(false);
      setMessage({
        status: "error",
        text: "The receipt could not be uploaded. Try another image.",
      });
      return;
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
      setPending(false);
      setMessage({
        status: "error",
        text: "Receipt details could not be saved. Refresh and try again.",
      });
      return;
    }

    if (inputRef.current) inputRef.current.value = "";
    setPending(false);
    setMessage({ status: "success", text: "Receipt attached to this bill." });
    router.refresh();
  }

  async function removeReceipt() {
    if (
      !receipt ||
      !window.confirm(
        "Remove this receipt photo? Bill members will no longer be able to view it.",
      )
    ) {
      return;
    }

    setPending(true);
    setMessage(null);

    const supabase = createClient();
    const { error: metadataError } = await supabase
      .from("bill_receipts")
      .delete()
      .eq("id", receipt.id)
      .eq("bill_id", billId);

    if (metadataError) {
      setPending(false);
      setMessage({
        status: "error",
        text: "The receipt could not be removed. Refresh and try again.",
      });
      return;
    }

    await supabase.storage
      .from("bill-receipts")
      .remove([receipt.storagePath]);

    setPending(false);
    setMessage({ status: "success", text: "Receipt removed." });
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#dceafb] bg-[#f7fbff] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e5f1ff] text-[#1473e6]">
          <FileImage size={19} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold tracking-[-0.02em]">Receipt photo</h3>
          <p className="mt-1 text-sm leading-6 text-[#6f7f91]">
            Private to the biller and listed participants.
          </p>
        </div>
      </div>

      {receipt ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/7 bg-white">
            {receipt.signedUrl ? (
              <Image
                alt="Attached bill receipt"
                className="object-contain"
                fill
                sizes="(max-width: 768px) 100vw, 288px"
                src={receipt.signedUrl}
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center px-5 text-center text-sm text-[#8a8d94]">
                Receipt preview is temporarily unavailable.
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {receipt.originalName}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#858b93]">
              Attached by {receipt.uploaderName} ·{" "}
              {formatTimestamp(receipt.createdAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {receipt.signedUrl && (
                <a
                  className="button button-light"
                  href={receipt.signedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  View full size
                </a>
              )}
              {canManage && (
                <button
                  className="button text-[#a23e30] hover:bg-[#fff0ed]"
                  disabled={pending}
                  onClick={removeReceipt}
                  type="button"
                >
                  {pending ? (
                    <LoaderCircle
                      className="animate-spin"
                      size={16}
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 size={16} aria-hidden="true" />
                  )}
                  Remove receipt
                </button>
              )}
            </div>
          </div>
        </div>
      ) : canManage ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#a8cfff] bg-white p-4">
          <label
            className="flex items-center gap-2 text-sm font-semibold"
            htmlFor={`receipt-${billId}`}
          >
            <Camera size={16} aria-hidden="true" />
            Choose receipt photo
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="mt-3 block w-full text-sm text-[#6f727a] file:mr-4 file:rounded-full file:border-0 file:bg-[#edf5ff] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[#125cad] hover:file:bg-[#e1efff]"
            disabled={pending}
            id={`receipt-${billId}`}
            ref={inputRef}
            type="file"
          />
          <p className="mt-2 text-xs leading-5 text-[#8a8f97]">
            JPG, PNG, or WebP. Maximum 5 MB. One receipt per bill.
          </p>
          <button
            className="button button-primary mt-4"
            disabled={pending}
            onClick={uploadReceipt}
            type="button"
          >
            {pending ? (
              <LoaderCircle
                className="animate-spin"
                size={17}
                aria-hidden="true"
              />
            ) : (
              <Upload size={17} aria-hidden="true" />
            )}
            {pending ? "Uploading receipt" : "Attach receipt"}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-[#858991]">
          No receipt photo has been attached.
        </p>
      )}

      {message && (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            message.status === "success"
              ? "bg-[#eaf8ee] text-[#2f7042]"
              : "bg-[#fff0ed] text-[#a23e30]"
          }`}
          role={message.status === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
