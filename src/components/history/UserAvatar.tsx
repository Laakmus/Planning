import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userName: string | null;
  /** Optional CSS class for sizing (defaults to h-8 w-8) */
  className?: string;
}

/**
 * User avatar showing initials in a colored circle.
 * Color is deterministic based on name hash.
 */
export function UserAvatar({ userName, className }: UserAvatarProps) {
  const initials = getInitials(userName);
  const bgColor = getAvatarColor(userName);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-xs font-bold text-white",
        bgColor,
        className ?? "h-8 w-8 border-2 border-background",
      )}
      title={userName ?? "Użytkownik"}
    >
      {initials}
    </div>
  );
}

/** Extract up to 2 initials from a name string */
function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

/** Deterministic background color based on name */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function getAvatarColor(name: string | null): string {
  if (!name) return "bg-slate-400";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
