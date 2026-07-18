"use client";

import {
  CalendarClock,
  CirclePlus,
  ListChecks,
  LoaderCircle,
  Radio,
  Trash2,
} from "lucide-react";
import { useActionState, useState } from "react";
import Link from "next/link";

import { createPoll, type PollActionState } from "@/lib/polls/actions";

const initialState: PollActionState = {};

type OptionRow = { id: string; label: string };

export function CreatePollForm() {
  const [state, action, pending] = useActionState(createPoll, initialState);
  const [allowsMultiple, setAllowsMultiple] = useState<"multiple" | "single">("single");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [options, setOptions] = useState<OptionRow[]>([
    { id: "option-1", label: "" },
    { id: "option-2", label: "" },
  ]);

  const expiresAt = expiresAtLocal
    ? new Date(expiresAtLocal).toISOString()
    : "";

  function addOption() {
    if (options.length >= 10) return;
    setOptions((current) => [
      ...current,
      { id: `option-${crypto.randomUUID()}`, label: "" },
    ]);
  }

  function updateOption(id: string, label: string) {
    setOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, label } : option)),
    );
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((option) => option.id !== id));
  }

  return (
    <form action={action} className="mt-8 grid gap-6" noValidate>
      <input name="expiresAt" type="hidden" value={expiresAt} />
      <input
        name="optionsJson"
        type="hidden"
        value={JSON.stringify(options.map(({ label }) => label))}
      />

      <section className="rounded-[1.7rem] border border-black/7 bg-white p-5 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-7">
        <label className="text-sm font-semibold" htmlFor="question">
          What should the circle decide?
        </label>
        <textarea
          className="field mt-2 min-h-28 resize-y py-3 text-lg"
          id="question"
          maxLength={240}
          name="question"
          placeholder="Where should we go this weekend?"
          required
        />
        {state.errors?.question?.[0] && (
          <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">
            {state.errors.question[0]}
          </p>
        )}
      </section>

      <section className="rounded-[1.7rem] border border-black/7 bg-white p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff4dc] text-[#a66a10]">
            <ListChecks size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Answer options</h2>
            <p className="mt-1 text-sm leading-6 text-[#74777f]">
              Add between 2 and 10 unique choices.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {options.map((option, index) => (
            <div className="flex items-center gap-2" key={option.id}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1f2f3] text-sm font-bold text-[#777a82]">
                {index + 1}
              </span>
              <input
                aria-label={`Option ${index + 1}`}
                className="field h-11"
                maxLength={100}
                onChange={(event) => updateOption(option.id, event.target.value)}
                placeholder={`Option ${index + 1}`}
                required
                value={option.label}
              />
              <button
                aria-label={`Remove option ${index + 1}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#a0a2a8] hover:bg-[#fff0ed] hover:text-[#b74436] disabled:cursor-not-allowed disabled:opacity-30"
                disabled={options.length <= 2}
                onClick={() => removeOption(option.id)}
                type="button"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button
          className="button button-light mt-4"
          disabled={options.length >= 10}
          onClick={addOption}
          type="button"
        >
          <CirclePlus size={17} aria-hidden="true" /> Add option
        </button>
      </section>

      <section className="grid gap-5 rounded-[1.7rem] border border-black/7 bg-white p-5 sm:p-7 lg:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold">How many choices can each person make?</legend>
          <div className="mt-3 grid gap-2">
            {([
              ["single", "Single choice", "Each person chooses exactly one option."],
              ["multiple", "Multiple choice", "Each person can choose one or more options."],
            ] as const).map(([value, label, description]) => (
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                  allowsMultiple === value
                    ? "border-[#8fc3ff] bg-[#f5faff]"
                    : "border-[#e3e4e7]"
                }`}
                key={value}
              >
                <input
                  checked={allowsMultiple === value}
                  className="mt-1 accent-[#1473e6]"
                  name="allowsMultiple"
                  onChange={() => setAllowsMultiple(value)}
                  type="radio"
                  value={value}
                />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#858890]">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="text-sm font-semibold" htmlFor="expiresAtLocal">
            Optional closing time
          </label>
          <div className="relative mt-3">
            <CalendarClock className="pointer-events-none absolute left-3 top-3 text-[#92959d]" size={17} aria-hidden="true" />
            <input
              className="field h-11 pl-10"
              id="expiresAtLocal"
              onChange={(event) => setExpiresAtLocal(event.target.value)}
              type="datetime-local"
              value={expiresAtLocal}
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#858890]">
            The browser converts your local time accurately. Leave blank to keep the poll open until you close it.
          </p>
          {state.errors?.expiresAt?.[0] && (
            <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">
              {state.errors.expiresAt[0]}
            </p>
          )}
        </div>
      </section>

      {state.message && (
        <p className="rounded-2xl bg-[#fff3f1] px-4 py-3 text-sm text-[#9e342a]" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link className="button button-light" href="/polls">Cancel</Link>
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Radio size={17} aria-hidden="true" />}
          {pending ? "Creating poll" : "Publish poll"}
        </button>
      </div>
    </form>
  );
}
