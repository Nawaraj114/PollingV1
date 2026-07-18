"use client";

import { Camera, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { useActionState } from "react";

import {
  updateAccount,
  type AccountState,
} from "@/lib/account/actions";
import { MemberAvatar } from "./member-avatar";

const initialAccountState: AccountState = {};

export function AccountForm({
  avatarUrl,
  email,
  fullName,
}: {
  avatarUrl: string | null;
  email: string;
  fullName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateAccount,
    initialAccountState,
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <MemberAvatar
          avatarUrl={avatarUrl}
          className="h-24 w-24 text-xl"
          name={fullName}
        />
        <div className="flex-1">
          <label
            className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3d3f44]"
            htmlFor="avatar"
          >
            <Camera size={16} aria-hidden="true" />
            Profile photo
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm text-[#6f727a] file:mr-4 file:rounded-full file:border-0 file:bg-[#edf5ff] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[#125cad] hover:file:bg-[#e1efff]"
            id="avatar"
            name="avatar"
            type="file"
          />
          <p className="mt-2 text-xs leading-5 text-[#92959d]">
            JPG, PNG, or WebP. Maximum 2 MB.
          </p>
          {avatarUrl && (
            <label className="mt-3 flex items-center gap-2 text-sm text-[#6f727a]">
              <input
                className="h-4 w-4 rounded border-[#c9cbd0] accent-[#1473e6]"
                name="removeAvatar"
                type="checkbox"
              />
              Remove current photo
            </label>
          )}
          {state.errors?.avatar?.[0] && (
            <p className="mt-2 text-sm text-[#c43f32]" role="alert">
              {state.errors.avatar[0]}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          className="mb-2 block text-sm font-semibold text-[#3d3f44]"
          htmlFor="fullName"
        >
          Full name
        </label>
        <input
          className="field"
          defaultValue={fullName}
          id="fullName"
          name="fullName"
          required
        />
        {state.errors?.fullName?.[0] && (
          <p className="mt-1.5 text-sm text-[#c43f32]" role="alert">
            {state.errors.fullName[0]}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[#3d3f44]" htmlFor="email">
          Email address
        </label>
        <input
          className="field bg-[#f7f7f8] text-[#777a82]"
          disabled
          id="email"
          value={email}
        />
        <p className="mt-2 text-xs text-[#92959d]">
          Email changes are managed by the circle administrator.
        </p>
      </div>

      {state.message && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-6 ${
            state.status === "success"
              ? "border-[#b9dfc5] bg-[#eefaf1] text-[#27663a]"
              : "border-[#f1c5bf] bg-[#fff3f1] text-[#9e342a]"
          }`}
          role="status"
        >
          {state.status === "success" && (
            <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          )}
          <span>{state.message}</span>
        </div>
      )}

      <button
        className="button button-primary h-12 px-6"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
            Saving
          </>
        ) : (
          <>
            <Save size={18} aria-hidden="true" />
            Save changes
          </>
        )}
      </button>
    </form>
  );
}
