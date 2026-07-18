import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type StepUpAction = "accept_allocation" | "confirm_receipt";

type CredentialRow = {
  backed_up: boolean;
  counter: number;
  credential_id: string;
  device_type: "multiDevice" | "singleDevice";
  id: string;
  public_key: string;
  rp_id: string;
  transports: AuthenticatorTransportFuture[];
  user_id: string;
};

type ChallengeRow = {
  action_type: StepUpAction | null;
  ceremony: "authentication" | "registration";
  challenge: string;
  expires_at: string;
  id: string;
  rp_id: string;
  target_id: string | null;
  used_at: string | null;
  user_id: string;
};

const rpName = "FriendCircle";

function allowedOrigin(rawOrigin: string | null) {
  if (!rawOrigin) return null;

  try {
    const origin = new URL(rawOrigin);
    const local =
      origin.protocol === "http:" &&
      origin.port === "3000" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname);
    const production =
      origin.protocol === "https:" &&
      origin.hostname === "polling-v1-theta.vercel.app";
    const projectPreview =
      origin.protocol === "https:" &&
      /^polling-v1-[a-z0-9-]+-poll-ed\.vercel\.app$/.test(origin.hostname);

    if (!local && !production && !projectPreview) return null;

    return {
      origin: origin.origin,
      rpID: origin.hostname,
    };
  } catch {
    return null;
  }
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(origin: string | null, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: corsHeaders(origin),
    status,
  });
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requiredEnvironment() {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const secretKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !publishableKey || !secretKey) {
    throw new Error("Supabase function environment is incomplete.");
  }

  return { publishableKey, secretKey, url };
}

async function authorizeAction(
  admin: SupabaseClient,
  userId: string,
  action: StepUpAction,
  targetId: string,
) {
  const { data: participant } = await admin
    .from("bill_participants")
    .select("auth_status, bill_id, participant_id, payment_status")
    .eq("id", targetId)
    .maybeSingle();

  if (!participant) return false;

  if (action === "accept_allocation") {
    return participant.participant_id === userId && participant.auth_status === "pending";
  }

  if (
    participant.auth_status !== "authenticated" ||
    participant.payment_status !== "marked_paid"
  ) {
    return false;
  }

  const { data: bill } = await admin
    .from("bills")
    .select("biller_id, deleted_at")
    .eq("id", participant.bill_id)
    .maybeSingle();

  return Boolean(bill && !bill.deleted_at && bill.biller_id === userId);
}

async function consumeChallenge(
  admin: SupabaseClient,
  challenge: ChallengeRow,
) {
  const { data } = await admin
    .from("webauthn_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challenge.id)
    .eq("user_id", challenge.user_id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  return Boolean(data);
}

Deno.serve(async (request) => {
  const rawOrigin = request.headers.get("origin");
  const rpContext = allowedOrigin(rawOrigin);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(rpContext?.origin ?? null) });
  }

  if (request.method !== "POST") {
    return json(rpContext?.origin ?? null, { error: "Method not allowed." }, 405);
  }

  if (!rpContext) {
    return json(null, { error: "This site origin is not allowed for passkeys." }, 403);
  }

  try {
    const { publishableKey, secretKey, url } = requiredEnvironment();
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return json(rpContext.origin, { error: "Authentication is required." }, 401);
    }

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user || !user.email) {
      return json(rpContext.origin, { error: "Your session is no longer valid." }, 401);
    }

    const body = await request.json() as Record<string, unknown>;
    const operation = typeof body.operation === "string" ? body.operation : "";

    if (operation === "registration-options") {
      const [{ data: profile }, { data: credentials }] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", user.id).single(),
        admin
          .from("webauthn_credentials")
          .select("credential_id, transports")
          .eq("user_id", user.id)
          .eq("rp_id", rpContext.rpID),
      ]);
      const options = await generateRegistrationOptions({
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
        excludeCredentials: (credentials ?? []).map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as AuthenticatorTransportFuture[],
        })),
        preferredAuthenticatorType: "localDevice",
        rpID: rpContext.rpID,
        rpName,
        supportedAlgorithmIDs: [-7, -257],
        userDisplayName: profile?.full_name ?? user.email,
        userID: new TextEncoder().encode(user.id),
        userName: user.email,
      });
      const { data: challenge, error } = await admin
        .from("webauthn_challenges")
        .insert({
          ceremony: "registration",
          challenge: options.challenge,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          rp_id: rpContext.rpID,
          user_id: user.id,
        })
        .select("id")
        .single();

      if (error || !challenge) throw new Error("Could not store registration challenge.");
      return json(rpContext.origin, { challengeId: challenge.id, options });
    }

    if (operation === "registration-verify") {
      const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim() : "";
      const response = body.response as RegistrationResponseJSON | undefined;
      if (!challengeId || !response || deviceLabel.length < 2 || deviceLabel.length > 80) {
        return json(rpContext.origin, { error: "Registration details are invalid." }, 400);
      }

      const { data: challenge } = await admin
        .from("webauthn_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("user_id", user.id)
        .eq("ceremony", "registration")
        .eq("rp_id", rpContext.rpID)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<ChallengeRow>();
      if (!challenge) return json(rpContext.origin, { error: "Registration challenge expired." }, 400);

      const verification = await verifyRegistrationResponse({
        expectedChallenge: challenge.challenge,
        expectedOrigin: rpContext.origin,
        expectedRPID: rpContext.rpID,
        requireUserVerification: true,
        response,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return json(rpContext.origin, { error: "Passkey registration was not verified." }, 400);
      }
      if (!(await consumeChallenge(admin, challenge))) {
        return json(rpContext.origin, { error: "Registration challenge was already used." }, 409);
      }

      const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;
      const { error } = await admin.from("webauthn_credentials").insert({
        backed_up: credentialBackedUp,
        counter: credential.counter,
        credential_id: credential.id,
        device_label: deviceLabel,
        device_type: credentialDeviceType,
        public_key: bytesToBase64Url(credential.publicKey),
        rp_id: rpContext.rpID,
        transports: credential.transports ?? [],
        user_id: user.id,
      });
      if (error) throw new Error("That passkey is already registered or could not be saved.");

      return json(rpContext.origin, { verified: true });
    }

    if (operation === "authentication-options") {
      const action = body.action as StepUpAction;
      const targetId = typeof body.targetId === "string" ? body.targetId : "";
      if (!targetId || !["accept_allocation", "confirm_receipt"].includes(action)) {
        return json(rpContext.origin, { error: "Passkey action is invalid." }, 400);
      }
      if (!(await authorizeAction(admin, user.id, action, targetId))) {
        return json(rpContext.origin, { error: "This action is no longer available." }, 403);
      }

      const { data: credentials } = await admin
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_id", user.id)
        .eq("rp_id", rpContext.rpID);
      if (!credentials?.length) {
        return json(rpContext.origin, { error: "Register a passkey for this site first." }, 409);
      }

      const options = await generateAuthenticationOptions({
        allowCredentials: credentials.map((credential) => ({
          id: credential.credential_id,
          transports: credential.transports as AuthenticatorTransportFuture[],
        })),
        rpID: rpContext.rpID,
        userVerification: "required",
      });
      const { data: challenge, error } = await admin
        .from("webauthn_challenges")
        .insert({
          action_type: action,
          ceremony: "authentication",
          challenge: options.challenge,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          rp_id: rpContext.rpID,
          target_id: targetId,
          user_id: user.id,
        })
        .select("id")
        .single();
      if (error || !challenge) throw new Error("Could not store authentication challenge.");

      return json(rpContext.origin, { challengeId: challenge.id, options });
    }

    if (operation === "authentication-verify") {
      const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      const response = body.response as AuthenticationResponseJSON | undefined;
      if (!challengeId || !response) {
        return json(rpContext.origin, { error: "Authentication details are invalid." }, 400);
      }

      const { data: challenge } = await admin
        .from("webauthn_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("user_id", user.id)
        .eq("ceremony", "authentication")
        .eq("rp_id", rpContext.rpID)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<ChallengeRow>();
      if (!challenge?.action_type || !challenge.target_id) {
        return json(rpContext.origin, { error: "Authentication challenge expired." }, 400);
      }
      if (!(await authorizeAction(admin, user.id, challenge.action_type, challenge.target_id))) {
        return json(rpContext.origin, { error: "This action is no longer available." }, 403);
      }

      const { data: credential } = await admin
        .from("webauthn_credentials")
        .select("*")
        .eq("credential_id", response.id)
        .eq("user_id", user.id)
        .eq("rp_id", rpContext.rpID)
        .maybeSingle<CredentialRow>();
      if (!credential) return json(rpContext.origin, { error: "Passkey was not found." }, 404);

      const webauthnCredential: WebAuthnCredential = {
        counter: credential.counter,
        id: credential.credential_id,
        publicKey: base64UrlToBytes(credential.public_key),
        transports: credential.transports,
      };
      const verification = await verifyAuthenticationResponse({
        credential: webauthnCredential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: rpContext.origin,
        expectedRPID: rpContext.rpID,
        requireUserVerification: true,
        response,
      });
      if (!verification.verified) {
        return json(rpContext.origin, { error: "Passkey authentication was not verified." }, 400);
      }
      if (!(await consumeChallenge(admin, challenge))) {
        return json(rpContext.origin, { error: "Authentication challenge was already used." }, 409);
      }

      const { data: updatedCredential } = await admin
        .from("webauthn_credentials")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", credential.id)
        .eq("counter", credential.counter)
        .select("id")
        .maybeSingle();
      if (!updatedCredential) throw new Error("Passkey counter could not be updated safely.");

      const { error } = await admin.rpc("complete_webauthn_bill_action", {
        p_action_type: challenge.action_type,
        p_participant_id: challenge.target_id,
        p_user_id: user.id,
      });
      if (error) throw new Error("The verified billing action could not be completed.");

      return json(rpContext.origin, { verified: true });
    }

    return json(rpContext.origin, { error: "Unknown WebAuthn operation." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passkey operation failed.";
    console.error(message);
    return json(rpContext.origin, { error: message }, 400);
  }
});
