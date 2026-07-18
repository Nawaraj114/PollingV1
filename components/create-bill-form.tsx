"use client";

import {
  Calculator,
  ChevronDown,
  CirclePlus,
  LoaderCircle,
  Minus,
  ReceiptText,
  Users,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  createBill,
  type CreateBillState,
} from "@/lib/bills/actions";
import { formatInr } from "@/lib/bills/money";
import {
  BillSplitError,
  calculateBillSplit,
  parseAmountToMinor,
} from "@/lib/validations/billSplit";
import { MemberAvatar } from "./member-avatar";

type Category = { id: string; name: string };
type Member = {
  avatarUrl: string | null;
  fullName: string;
  id: string;
};
type LineItemDraft = { amount: string; categoryId: string; key: string };
type ParticipantDraft = {
  breakdown: boolean;
  exactAmount: string;
  lineItems: LineItemDraft[];
};

const initialState: CreateBillState = {};

function newLineItem(
  categories: Category[],
  usedCategoryIds: string[] = [],
): LineItemDraft {
  return {
    amount: "",
    categoryId:
      categories.find(({ id }) => !usedCategoryIds.includes(id))?.id ??
      categories[0]?.id ??
      "",
    key: crypto.randomUUID(),
  };
}

export function CreateBillForm({
  categories,
  defaultDate,
  members,
}: {
  categories: Category[];
  defaultDate: string;
  members: Member[];
}) {
  const [state, formAction, pending] = useActionState(createBill, initialState);
  const [categoryChoice, setCategoryChoice] = useState(categories[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, ParticipantDraft>>({});
  const [totalAmount, setTotalAmount] = useState("");

  const selectedMembers = useMemo(
    () => members.filter(({ id }) => Boolean(drafts[id])),
    [drafts, members],
  );
  const preview = useMemo(() => {
    if (!selectedMembers.length || !totalAmount.trim()) {
      return { allocations: null, error: null };
    }

    try {
      const allocations = calculateBillSplit(
        parseAmountToMinor(totalAmount),
        selectedMembers.map(({ id }) => {
          const draft = drafts[id];

          return {
            exactMinor:
              !draft.breakdown && draft.exactAmount.trim()
                ? parseAmountToMinor(draft.exactAmount)
                : undefined,
            lineItems: draft.breakdown
              ? draft.lineItems.map(({ amount }) => ({
                  amountMinor: parseAmountToMinor(amount),
                }))
              : [],
            participantId: id,
          };
        }),
      );

      return { allocations, error: null };
    } catch (error) {
      return {
        allocations: null,
        error:
          error instanceof BillSplitError
            ? error.message
            : "The split could not be calculated.",
      };
    }
  }, [drafts, selectedMembers, totalAmount]);

  const participantsJson = JSON.stringify(
    selectedMembers.map(({ id }) => {
      const draft = drafts[id];

      return {
        exactAmount: draft.breakdown ? "" : draft.exactAmount,
        lineItems: draft.breakdown
          ? draft.lineItems.map(({ amount, categoryId }) => ({ amount, categoryId }))
          : [],
        participantId: id,
      };
    }),
  );

  function toggleMember(memberId: string) {
    setDrafts((current) => {
      if (current[memberId]) {
        const next = { ...current };
        delete next[memberId];
        return next;
      }

      return {
        ...current,
        [memberId]: { breakdown: false, exactAmount: "", lineItems: [] },
      };
    });
  }

  function updateDraft(memberId: string, update: Partial<ParticipantDraft>) {
    setDrafts((current) => ({
      ...current,
      [memberId]: { ...current[memberId], ...update },
    }));
  }

  function updateLineItem(
    memberId: string,
    itemKey: string,
    update: Partial<LineItemDraft>,
  ) {
    const draft = drafts[memberId];
    updateDraft(memberId, {
      lineItems: draft.lineItems.map((item) =>
        item.key === itemKey ? { ...item, ...update } : item,
      ),
    });
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input
        name="categoryId"
        type="hidden"
        value={categoryChoice === "custom" ? "" : categoryChoice}
      />
      <input name="participantsJson" type="hidden" value={participantsJson} />

      <section className="rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
            <ReceiptText size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold tracking-[-0.02em]">Bill details</h2>
            <p className="text-sm text-[#858890]">What was paid, and when?</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="totalAmount">
              Total amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold text-[#777a82]">₹</span>
              <input
                className="field pl-9"
                id="totalAmount"
                inputMode="decimal"
                name="totalAmount"
                onChange={(event) => setTotalAmount(event.target.value)}
                placeholder="0.00"
                required
                value={totalAmount}
              />
            </div>
            {state.errors?.totalAmount?.[0] && (
              <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.totalAmount[0]}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="incurredOn">
              Bill date
            </label>
            <input className="field" defaultValue={defaultDate} id="incurredOn" name="incurredOn" required type="date" />
            {state.errors?.incurredOn?.[0] && (
              <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.incurredOn[0]}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="categoryChoice">
              Category
            </label>
            <div className="relative">
              <select
                className="field appearance-none pr-10"
                id="categoryChoice"
                onChange={(event) => setCategoryChoice(event.target.value)}
                value={categoryChoice}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
                <option value="custom">Add a custom category…</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#858890]" size={17} aria-hidden="true" />
            </div>
          </div>

          {categoryChoice === "custom" && (
            <div>
              <label className="mb-2 block text-sm font-semibold" htmlFor="customCategory">
                Custom category
              </label>
              <input className="field" id="customCategory" maxLength={40} name="customCategory" placeholder="e.g. Road trip" required />
              {state.errors?.customCategory?.[0] && (
                <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.customCategory[0]}</p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold" htmlFor="description">
              Description
            </label>
            <textarea className="field min-h-28 resize-y py-3" id="description" maxLength={200} name="description" placeholder="e.g. Saturday dinner at Thamel" required />
            {state.errors?.description?.[0] && (
              <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">{state.errors.description[0]}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff4df] text-[#a86608]">
            <Users size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold tracking-[-0.02em]">Who owes this bill?</h2>
            <p className="text-sm text-[#858890]">Select friends other than yourself.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {members.map((member) => {
            const selected = Boolean(drafts[member.id]);
            return (
              <button
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${selected ? "border-[#1473e6] bg-[#f1f7ff]" : "border-[#dedfe3] bg-white hover:border-[#b9bbc1]"}`}
                key={member.id}
                onClick={() => toggleMember(member.id)}
                type="button"
              >
                <MemberAvatar avatarUrl={member.avatarUrl} name={member.fullName} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{member.fullName}</span>
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-[#1473e6] bg-[#1473e6] text-white" : "border-[#c7c9ce]"}`}>
                  {selected && <CirclePlus size={13} strokeWidth={3} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>

        {!members.length && (
          <p className="mt-5 rounded-2xl bg-[#fff8e8] px-4 py-3 text-sm leading-6 text-[#79571c]">
            Add at least one more confirmed user in Supabase before creating a bill.
          </p>
        )}
      </section>

      {selectedMembers.length > 0 && (
        <section className="rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#efeefd] text-[#625cb5]">
              <Calculator size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold tracking-[-0.02em]">Split details</h2>
              <p className="text-sm text-[#858890]">Leave exact amounts blank to split the remainder equally.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {selectedMembers.map((member) => {
              const draft = drafts[member.id];
              const allocation = preview.allocations?.find(({ participantId }) => participantId === member.id);

              return (
                <article className="rounded-2xl border border-[#e1e2e5] bg-[#fafafa] p-4" key={member.id}>
                  <div className="flex flex-wrap items-center gap-3">
                    <MemberAvatar avatarUrl={member.avatarUrl} name={member.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{member.fullName}</p>
                      <p className="text-xs text-[#8c8f96]">
                        {allocation ? `${allocation.method === "automatic" ? "Auto-split" : allocation.method === "explicit" ? "Exact amount" : "Category breakdown"} · ${formatInr(allocation.owedMinor / 100)}` : "Waiting for a valid total"}
                      </p>
                    </div>
                    <button
                      className="text-xs font-semibold text-[#1473e6] hover:text-[#095fbf]"
                      onClick={() => updateDraft(member.id, {
                        breakdown: !draft.breakdown,
                        exactAmount: "",
                        lineItems: draft.breakdown ? [] : [newLineItem(categories)],
                      })}
                      type="button"
                    >
                      {draft.breakdown ? "Use exact / auto" : "Use category breakdown"}
                    </button>
                  </div>

                  {!draft.breakdown ? (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-xs font-semibold text-[#676a72]" htmlFor={`exact-${member.id}`}>
                        Exact amount (optional)
                      </label>
                      <input
                        className="field h-11"
                        id={`exact-${member.id}`}
                        inputMode="decimal"
                        onChange={(event) => updateDraft(member.id, { exactAmount: event.target.value })}
                        placeholder="Blank = auto-split"
                        value={draft.exactAmount}
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {draft.lineItems.map((item) => (
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={item.key}>
                          <select
                            aria-label={`Category for ${member.fullName}`}
                            className="field h-11 min-w-0"
                            onChange={(event) => updateLineItem(member.id, item.key, { categoryId: event.target.value })}
                            value={item.categoryId}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                          <input
                            aria-label={`Amount for ${member.fullName}`}
                            className="field h-11 min-w-0"
                            inputMode="decimal"
                            onChange={(event) => updateLineItem(member.id, item.key, { amount: event.target.value })}
                            placeholder="0.00"
                            value={item.amount}
                          />
                          <button
                            aria-label="Remove line item"
                            className="grid h-11 w-11 place-items-center rounded-xl text-[#9d4b42] hover:bg-[#fff0ee]"
                            disabled={draft.lineItems.length === 1}
                            onClick={() => updateDraft(member.id, { lineItems: draft.lineItems.filter(({ key }) => key !== item.key) })}
                            type="button"
                          >
                            <Minus size={17} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      <button
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1473e6] disabled:text-[#aaa]"
                        disabled={draft.lineItems.length >= categories.length}
                        onClick={() => updateDraft(member.id, {
                          lineItems: [
                            ...draft.lineItems,
                            newLineItem(
                              categories,
                              draft.lineItems.map(({ categoryId }) => categoryId),
                            ),
                          ],
                        })}
                        type="button"
                      >
                        <CirclePlus size={15} aria-hidden="true" /> Add another category
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(preview.error || state.message) && (
        <div className="rounded-2xl border border-[#f1c5bf] bg-[#fff3f1] px-4 py-3 text-sm leading-6 text-[#9e342a]" role="alert">
          {state.message ?? preview.error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#858890]">
          The server recalculates every amount before saving.
        </p>
        <button
          className="button button-primary h-12 px-6"
          disabled={pending || !preview.allocations}
          type="submit"
        >
          {pending ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <ReceiptText size={18} aria-hidden="true" />}
          {pending ? "Creating bill" : "Create bill"}
        </button>
      </div>
    </form>
  );
}
