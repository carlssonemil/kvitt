"use client"

import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user-avatar"

interface Member {
  display_name: string
  avatar_url: string | null
}

interface GroupMemberAvatarsProps {
  members: Member[]
  max?: number
}

export function GroupMemberAvatars({ members, max = 4 }: GroupMemberAvatarsProps) {
  const visible = members.slice(0, max)
  const hidden = members.slice(max)

  return (
    <AvatarGroup>
      {visible.map((member) => (
        <Tooltip key={member.display_name}>
          <TooltipTrigger asChild>
            <span>
              <UserAvatar name={member.display_name} avatarUrl={member.avatar_url} size="sm" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{member.display_name}</TooltipContent>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AvatarGroupCount>+{hidden.length}</AvatarGroupCount>
          </TooltipTrigger>
          <TooltipContent>
            {hidden.map((m) => m.display_name).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  )
}
