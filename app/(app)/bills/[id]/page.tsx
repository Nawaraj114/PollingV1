import { redirect } from "next/navigation";

export default async function LegacyBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/bills?bill=${encodeURIComponent(id)}`);
}
