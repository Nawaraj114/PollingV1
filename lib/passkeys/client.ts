"use client";

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

import { createClient } from "@/lib/supabase/client";

type StepUpAction = "accept_allocation" | "confirm_receipt";

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("webauthn", { body });

  if (error) {
    let message = error.message;
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // Keep the SDK error when the function did not return JSON.
      }
    }
    throw new Error(message);
  }

  return data as T;
}

export async function registerPasskey(deviceLabel: string) {
  const setup = await invoke<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>({ operation: "registration-options" });
  const response = await startRegistration({ optionsJSON: setup.options });
  const result = await invoke<{ verified: boolean }>({
    challengeId: setup.challengeId,
    deviceLabel,
    operation: "registration-verify",
    response,
  });

  if (!result.verified) throw new Error("The passkey could not be verified.");
}

export async function performPasskeyStepUp(
  action: StepUpAction,
  targetId: string,
) {
  const setup = await invoke<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>({ action, operation: "authentication-options", targetId });
  const response = await startAuthentication({ optionsJSON: setup.options });
  const result = await invoke<{ verified: boolean }>({
    challengeId: setup.challengeId,
    operation: "authentication-verify",
    response,
  });

  if (!result.verified) throw new Error("The passkey could not be verified.");
}
