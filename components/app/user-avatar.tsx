import { cn } from "@/lib/utils";

const PALETTE = ["bg-blue-600", "bg-indigo-500", "bg-teal-600", "bg-cyan-600", "bg-slate-500", "bg-violet-500"];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length];
}

export function UserAvatar({
  name,
  image,
  size = "sm",
  className,
  tone = "neutral",
}: {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** neutral = pale chip (Direction 1); color = hashed palette for lanes/legends */
  tone?: "neutral" | "color";
}) {
  const dims = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" }[size];
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} title={name} className={cn("rounded-full object-cover", dims, className)} />;
  }
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dims,
        tone === "color" ? cn("text-white", colorFor(name)) : "bg-[#edf1f8] text-[#5e718b]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ users, max = 3 }: { users: { id: string; name: string; image?: string | null }[]; max?: number }) {
  if (users.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((u) => (
        <UserAvatar key={u.id} name={u.name} image={u.image} size="sm" className="ring-2 ring-white dark:ring-neutral-900" />
      ))}
      {rest > 0 && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold ring-2 ring-white dark:bg-neutral-700 dark:ring-neutral-900">
          +{rest}
        </span>
      )}
    </span>
  );
}
