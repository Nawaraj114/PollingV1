import { AppNavigation } from "@/components/app-navigation";
import { requireViewer } from "@/lib/auth/session";
import { parseNotificationFeed } from "@/lib/notifications/feed";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: notificationFeed } = await supabase.rpc(
    "get_action_notifications",
  );
  const notificationCount = parseNotificationFeed(notificationFeed).length;

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-24 md:pb-0">
      <AppNavigation
        notificationCount={notificationCount}
        viewerAvatarUrl={viewer.avatarUrl}
        viewerName={viewer.fullName}
      />
      {children}
    </div>
  );
}
