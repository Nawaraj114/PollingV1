"use client";

import { Fingerprint, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { performPasskeyStepUp } from "@/lib/passkeys/client";

export function PasskeyStepUpButton({
  action,
  label,
  targetId,
}: {
  action: "accept_allocation" | "confirm_receipt";
  label: string;
  targetId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function verify() {
    setPending(true);
    setMessage(null);
    try {
      await performPasskeyStepUp(action, targetId);
      setMessage("Passkey verified. The action was recorded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey verification failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="button button-primary w-full" disabled={pending} onClick={verify} type="button">
        {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Fingerprint size={17} aria-hidden="true" />}
        {pending ? "Waiting for device" : label}
      </button>
      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.startsWith("Passkey verified") ? "bg-[#eefaf1] text-[#27663a]" : "bg-[#fff3f1] text-[#9e342a]"}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
