import { describe, expect, it } from "vitest";

import {
  maxReceiptBytes,
  validateReceiptFile,
} from "./receipts";

function receiptFile(type: string, size: number) {
  return { size, type } as File;
}

describe("validateReceiptFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts supported %s images",
    (type) => {
      expect(validateReceiptFile(receiptFile(type, 1024))).toBeNull();
    },
  );

  it("accepts a receipt at the exact size limit", () => {
    expect(
      validateReceiptFile(receiptFile("image/jpeg", maxReceiptBytes)),
    ).toBeNull();
  });

  it.each(["image/gif", "image/heic", "application/pdf", ""])(
    "rejects unsupported type %s",
    (type) => {
      expect(validateReceiptFile(receiptFile(type, 1024))).toContain(
        "JPG, PNG, or WebP",
      );
    },
  );

  it.each([0, maxReceiptBytes + 1])(
    "rejects invalid file size %s",
    (size) => {
      expect(validateReceiptFile(receiptFile("image/png", size))).toContain(
        "5 MB or smaller",
      );
    },
  );
});
