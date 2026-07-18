import type { Metadata } from "next";

import { ConfirmSignupForm } from "@/components/confirm-signup-form";

export const metadata: Metadata = { title: "Confirm account" };

export default async function ConfirmSignupPage({
  searchParams,
}: PageProps<"/confirm-signup">) {
  const params = await searchParams;
  const tokenHash =
    typeof params.token_hash === "string" ? params.token_hash : undefined;

  return <ConfirmSignupForm tokenHash={tokenHash} />;
}
