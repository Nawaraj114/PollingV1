"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer, requireViewerId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  closePollSchema,
  createPollSchema,
  pollOptionsSchema,
  votePollSchema,
} from "./schemas";

export type PollActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  status?: "error" | "success";
};

function errorState(message: string): PollActionState {
  return { message, status: "error" };
}

function refreshPoll(pollId: string) {
  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/polls");
  revalidatePath("/dashboard");
}

export async function createPoll(
  _previousState: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const parsed = createPollSchema.safeParse({
    allowsMultiple: formData.get("allowsMultiple"),
    expiresAt: formData.get("expiresAt"),
    optionsJson: formData.get("optionsJson"),
    question: formData.get("question"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  let rawOptions: unknown;
  try {
    rawOptions = JSON.parse(parsed.data.optionsJson);
  } catch {
    return errorState("The poll options could not be read.");
  }

  const options = pollOptionsSchema.safeParse(rawOptions);
  if (!options.success) {
    return errorState(options.error.issues[0]?.message ?? "Review the poll options.");
  }

  if (
    parsed.data.expiresAt &&
    new Date(parsed.data.expiresAt).getTime() <= Date.now()
  ) {
    return { errors: { expiresAt: ["Choose a future expiry time."] }, status: "error" };
  }

  await requireViewerId();
  const supabase = await createClient();
  const { data: pollId, error } = await supabase.rpc("create_poll", {
    p_allows_multiple: parsed.data.allowsMultiple === "multiple",
    p_expires_at: parsed.data.expiresAt || null,
    p_options: options.data,
    p_question: parsed.data.question,
  });

  if (error || !pollId) {
    return errorState("The poll could not be created. Review it and try again.");
  }

  revalidatePath("/polls");
  revalidatePath("/dashboard");
  redirect("/polls");
}

export async function castVote(
  _previousState: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const parsed = votePollSchema.safeParse({
    optionIds: formData.getAll("optionIds"),
    pollId: formData.get("pollId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ data: poll }, { data: existingVote }] = await Promise.all([
    supabase
      .from("polls")
      .select("allows_multiple, expires_at, status")
      .eq("id", parsed.data.pollId)
      .maybeSingle(),
    supabase
      .from("poll_votes")
      .select("id")
      .eq("poll_id", parsed.data.pollId)
      .eq("voter_id", viewer.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!poll) {
    return errorState("That poll could not be found.");
  }

  if (
    poll.status === "closed" ||
    (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now())
  ) {
    return errorState("This poll is closed.");
  }

  if (existingVote) {
    return errorState("You have already voted in this poll.");
  }

  if (!poll.allows_multiple && parsed.data.optionIds.length !== 1) {
    return errorState("Choose exactly one option for this poll.");
  }

  const { error } = await supabase.rpc("cast_poll_vote", {
    p_option_ids: parsed.data.optionIds,
    p_poll_id: parsed.data.pollId,
  });

  if (error) {
    return errorState("Your vote could not be recorded. Refresh and try again.");
  }

  refreshPoll(parsed.data.pollId);
  return { message: "Your vote is recorded and results are now live.", status: "success" };
}

export async function closePoll(
  _previousState: PollActionState,
  formData: FormData,
): Promise<PollActionState> {
  const parsed = closePollSchema.safeParse({ pollId: formData.get("pollId") });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, status: "error" };
  }

  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("polls")
    .select("created_by, status")
    .eq("id", parsed.data.pollId)
    .maybeSingle();

  if (!poll || poll.created_by !== viewer.id || poll.status !== "open") {
    return errorState("Only the creator can close an open poll.");
  }

  const { error } = await supabase.rpc("close_poll", {
    p_poll_id: parsed.data.pollId,
  });

  if (error) {
    return errorState("The poll could not be closed. Refresh and try again.");
  }

  refreshPoll(parsed.data.pollId);
  return { message: "Poll closed. The final result is locked.", status: "success" };
}
