import { MessagesSquare } from "lucide-react";
import Link from "next/link";

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="inline-flex items-center gap-3 text-[#202124] no-underline" href="/">
      <span className="grid h-10 w-10 place-items-center rounded-[0.9rem] bg-[#1473e6] text-white shadow-[0_8px_22px_rgba(20,115,230,0.24)]">
        <MessagesSquare size={20} strokeWidth={2.2} aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-[1.05rem] font-semibold tracking-[-0.035em]">
          FriendCircle
        </span>
      )}
    </Link>
  );
}
