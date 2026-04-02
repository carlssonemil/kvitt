import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: "xs" | "sm" | "default" | "lg"
}

// Palette derived from brand primary (teal, oklch hue 165).
// 7 hues at consistent lightness/chroma for uniform visual weight.
const AVATAR_COLORS = [
  { bg: "oklch(0.45 0.16 165)", fg: "oklch(0.98 0 0)" }, // teal (brand)
  { bg: "oklch(0.48 0.18 225)", fg: "oklch(0.98 0 0)" }, // sky
  { bg: "oklch(0.47 0.20 260)", fg: "oklch(0.98 0 0)" }, // indigo
  { bg: "oklch(0.50 0.18 290)", fg: "oklch(0.98 0 0)" }, // purple
  { bg: "oklch(0.52 0.18 350)", fg: "oklch(0.98 0 0)" }, // rose
  { bg: "oklch(0.55 0.18 40)",  fg: "oklch(0.98 0 0)" }, // orange
  { bg: "oklch(0.52 0.15 95)",  fg: "oklch(0.98 0 0)" }, // olive
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

function pickColor(name: string) {
  const hash = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}

export function UserAvatar({ name, avatarUrl, size = "default" }: UserAvatarProps) {
  const color = pickColor(name)
  return (
    <Avatar size={size}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback style={{ background: color.bg, color: color.fg }} className="font-semibold leading-none">
        <span className="translate-x-px inline-block">{getInitials(name)}</span>
      </AvatarFallback>
    </Avatar>
  )
}
