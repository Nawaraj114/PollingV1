export type BillLineItemInput = {
  amountMinor: number;
};

export type BillParticipantInput = {
  exactMinor?: number;
  lineItems?: BillLineItemInput[];
  participantId: string;
};

export type BillSplitAllocation = {
  method: "automatic" | "breakdown" | "explicit";
  owedMinor: number;
  participantId: string;
};

export class BillSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillSplitError";
  }
}

function requirePositiveMinor(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BillSplitError(`${label} must be a positive whole number of cents.`);
  }
}

export function calculateBillSplit(
  totalMinor: number,
  participants: BillParticipantInput[],
): BillSplitAllocation[] {
  requirePositiveMinor(totalMinor, "Bill total");

  if (!participants.length) {
    throw new BillSplitError("Choose at least one participant.");
  }

  const participantIds = new Set<string>();
  const fixedAllocations = new Map<
    string,
    Omit<BillSplitAllocation, "participantId">
  >();
  const automaticIds: string[] = [];

  for (const participant of participants) {
    if (!participant.participantId || participantIds.has(participant.participantId)) {
      throw new BillSplitError("Every participant must be unique.");
    }

    participantIds.add(participant.participantId);
    const lineItems = participant.lineItems ?? [];
    const hasBreakdown = lineItems.length > 0;
    const hasExact = participant.exactMinor !== undefined;

    if (hasBreakdown && hasExact) {
      throw new BillSplitError(
        "Use either an exact amount or a category breakdown for each participant.",
      );
    }

    if (hasBreakdown) {
      const owedMinor = lineItems.reduce((total, lineItem) => {
        requirePositiveMinor(lineItem.amountMinor, "Line item");
        return total + lineItem.amountMinor;
      }, 0);

      requirePositiveMinor(owedMinor, "Category breakdown");
      fixedAllocations.set(participant.participantId, {
        method: "breakdown",
        owedMinor,
      });
      continue;
    }

    if (hasExact) {
      requirePositiveMinor(participant.exactMinor!, "Exact amount");
      fixedAllocations.set(participant.participantId, {
        method: "explicit",
        owedMinor: participant.exactMinor!,
      });
      continue;
    }

    automaticIds.push(participant.participantId);
  }

  const fixedTotal = Array.from(fixedAllocations.values()).reduce(
    (total, allocation) => total + allocation.owedMinor,
    0,
  );

  if (fixedTotal > totalMinor) {
    throw new BillSplitError("Assigned amounts exceed the bill total.");
  }

  if (!automaticIds.length && fixedTotal !== totalMinor) {
    throw new BillSplitError(
      "Exact amounts must add up to the bill total when nobody is auto-split.",
    );
  }

  const automaticAllocations = new Map<string, number>();

  if (automaticIds.length) {
    const remainingMinor = totalMinor - fixedTotal;

    if (remainingMinor < automaticIds.length) {
      throw new BillSplitError(
        "The remaining amount must be at least ₹0.01 per auto-split participant.",
      );
    }

    const baseMinor = Math.floor(remainingMinor / automaticIds.length);
    const remainderMinor = remainingMinor % automaticIds.length;

    automaticIds.forEach((participantId, index) => {
      automaticAllocations.set(
        participantId,
        baseMinor + (index < remainderMinor ? 1 : 0),
      );
    });
  }

  const allocations = participants.map<BillSplitAllocation>((participant) => {
    const fixed = fixedAllocations.get(participant.participantId);

    if (fixed) {
      return { ...fixed, participantId: participant.participantId };
    }

    return {
      method: "automatic",
      owedMinor: automaticAllocations.get(participant.participantId)!,
      participantId: participant.participantId,
    };
  });

  const allocatedTotal = allocations.reduce(
    (total, allocation) => total + allocation.owedMinor,
    0,
  );

  if (allocatedTotal !== totalMinor) {
    throw new BillSplitError("The calculated split does not match the bill total.");
  }

  return allocations;
}

export function parseAmountToMinor(value: string) {
  const normalized = value.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new BillSplitError("Enter a valid amount with at most two decimal places.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  requirePositiveMinor(minor, "Amount");

  return minor;
}

export function minorToDecimal(minor: number) {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new BillSplitError("Minor units must be a non-negative safe integer.");
  }

  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
