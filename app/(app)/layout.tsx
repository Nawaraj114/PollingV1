import { AppNavigation } from "@/components/app-navigation";
import { requireViewer } from "@/lib/auth/session";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-24 md:pb-0">
      <AppNavigation viewerName={viewer.fullName} />
      {children}
    </div>
  );
}
