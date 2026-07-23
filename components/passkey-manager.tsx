"use client";

import {
  Fingerprint,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import {
  removePasskey,
  type PasskeyActionState,
} from "@/lib/passkeys/actions";
import { registerPasskey } from "@/lib/passkeys/client";

type Passkey = {
  backed_up: boolean;
  created_at: string;
  device_label: string;
  id: string;
  last_used_at: string | null;
  rp_id: string;
};

const initialState: PasskeyActionState = {};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(timestamp));
}

function RemovePasskeyForm({ passkey }: { passkey: Passkey }) {
  const [state, action, pending] = useActionState(removePasskey, initialState);
  return (
    <form action={action} className="mt-3 border-t border-[#ececef] pt-3">
      <input name="credentialId" type="hidden" value={passkey.id} />
      <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b8e95] hover:text-[#b74436]" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" size={13} aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
        {pending ? "Removing" : "Remove passkey"}
      </button>
      {state.message && <p className="mt-2 text-xs text-[#8b4a41]" role="status">{state.message}</p>}
    </form>
  );
}

export function PasskeyManager({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const [deviceLabel, setDeviceLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function register() {
    const cleanLabel = deviceLabel.trim();
    if (cleanLabel.length < 2 || cleanLabel.length > 80) {
      setMessage("Enter a device label between 2 and 80 characters.");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await registerPasskey(cleanLabel);
      setDeviceLabel("");
      setMessage("Passkey registered. You can now approve sensitive billing actions with this device.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey registration failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-[1.7rem] border border-[#9cc9ff] bg-white p-6 shadow-[0_10px_35px_rgba(20,115,230,0.06)] sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
          <Fingerprint size={21} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Passkeys for step-up approval</h2>
          <p className="mt-2 text-sm leading-6 text-[#74777f]">
            Register this device to use its fingerprint, face recognition, or device PIN when accepting bill allocations and confirming payments.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="text-sm font-semibold" htmlFor="deviceLabel">Device label</label>
          <input
            className="field mt-2 h-11"
            id="deviceLabel"
            maxLength={80}
            onChange={(event) => setDeviceLabel(event.target.value)}
            placeholder="My phone"
            value={deviceLabel}
          />
        </div>
        <button className="button button-primary h-11" disabled={pending} onClick={register} type="button">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}
          {pending ? "Follow device prompt" : "Register passkey"}
        </button>
      </div>
      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.startsWith("Passkey registered") ? "bg-[#eefaf1] text-[#27663a]" : "bg-[#fff3f1] text-[#9e342a]"}`} role="status">
          {message}
        </p>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Registered passkeys</h3>
          <span className="rounded-full bg-[#f1f2f3] px-2.5 py-1 text-xs font-semibold text-[#777a82]">{passkeys.length}</span>
        </div>
        {passkeys.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#f7f7f8] px-4 py-3 text-sm text-[#858890]">No passkey registered yet. Password approval remains available.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {passkeys.map((passkey) => (
              <article className="rounded-2xl border border-[#e3e4e7] p-4" key={passkey.id}>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 shrink-0 text-[#34704a]" size={17} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{passkey.device_label}</p>
                    <p className="mt-1 truncate text-xs text-[#92959d]" title={passkey.rp_id}>{passkey.rp_id}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#858890]">
                  Added {formatTimestamp(passkey.created_at)}
                  {passkey.last_used_at ? ` · used ${formatTimestamp(passkey.last_used_at)}` : ""}
                  {passkey.backed_up ? " · synced" : ""}
                </p>
                <RemovePasskeyForm passkey={passkey} />
              </article>
            ))}
          </div>
        )}
      </div>
      <p className="mt-5 text-xs leading-5 text-[#92959d]">
        Passkeys are hostname-specific. Preview and production deployments may need separate registration until a shared custom domain is configured.
      </p>
    </section>
  );
}
