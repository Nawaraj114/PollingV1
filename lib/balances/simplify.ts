export type BalanceObligation = {
  amountMinor: number;
  creditorId: string;
  debtorId: string;
};

export type MemberBalance = {
  memberId: string;
  netMinor: number;
};

export type SuggestedTransfer = {
  amountMinor: number;
  fromId: string;
  toId: string;
};

export type SimplifiedBalances = {
  memberBalances: MemberBalance[];
  transfers: SuggestedTransfer[];
};

function assertObligation(obligation: BalanceObligation) {
  if (
    !Number.isSafeInteger(obligation.amountMinor) ||
    obligation.amountMinor <= 0
  ) {
    throw new Error("Balance amounts must be positive integer minor units.");
  }

  if (!obligation.creditorId || !obligation.debtorId) {
    throw new Error("Every balance obligation must identify both members.");
  }

  if (obligation.creditorId === obligation.debtorId) {
    throw new Error("A member cannot owe money to themselves.");
  }
}

function byAmountThenId(
  left: { amountMinor: number; memberId: string },
  right: { amountMinor: number; memberId: string },
) {
  return (
    right.amountMinor - left.amountMinor ||
    left.memberId.localeCompare(right.memberId)
  );
}

export function simplifyBalances(
  obligations: BalanceObligation[],
): SimplifiedBalances {
  const netByMember = new Map<string, number>();

  obligations.forEach((obligation) => {
    assertObligation(obligation);
    netByMember.set(
      obligation.debtorId,
      (netByMember.get(obligation.debtorId) ?? 0) - obligation.amountMinor,
    );
    netByMember.set(
      obligation.creditorId,
      (netByMember.get(obligation.creditorId) ?? 0) + obligation.amountMinor,
    );
  });

  const memberBalances = Array.from(netByMember, ([memberId, netMinor]) => ({
    memberId,
    netMinor,
  }))
    .filter(({ netMinor }) => netMinor !== 0)
    .sort(
      (left, right) =>
        Math.abs(right.netMinor) - Math.abs(left.netMinor) ||
        left.memberId.localeCompare(right.memberId),
    );

  const debtors = memberBalances
    .filter(({ netMinor }) => netMinor < 0)
    .map(({ memberId, netMinor }) => ({
      amountMinor: -netMinor,
      memberId,
    }))
    .sort(byAmountThenId);
  const creditors = memberBalances
    .filter(({ netMinor }) => netMinor > 0)
    .map(({ memberId, netMinor }) => ({
      amountMinor: netMinor,
      memberId,
    }))
    .sort(byAmountThenId);
  const transfers: SuggestedTransfer[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(
      debtor.amountMinor,
      creditor.amountMinor,
    );

    transfers.push({
      amountMinor,
      fromId: debtor.memberId,
      toId: creditor.memberId,
    });

    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;

    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }

  if (
    debtorIndex !== debtors.length ||
    creditorIndex !== creditors.length
  ) {
    throw new Error("Circle balances do not resolve to zero.");
  }

  return { memberBalances, transfers };
}
