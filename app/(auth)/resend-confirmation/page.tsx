import type { Metadata } from "next";

import { ResendConfirmationForm } from "@/components/resend-confirmation-form";

export const metadata: Metadata = { title: "Resend confirmation" };

export default function ResendConfirmationPage() {
  return <ResendConfirmationForm />;
}
