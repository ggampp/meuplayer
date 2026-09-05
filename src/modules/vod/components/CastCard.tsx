import type { CastMember } from "../types/media";
import { PROFILE_BASE } from "../lib/constants";

export interface CastCardProps {
  member: CastMember;
  onClick: () => void;
}

export function CastCard({ member, onClick }: CastCardProps) {
  const profileUrl = member.profile_path
    ? `${PROFILE_BASE}${member.profile_path}`
    : null;
  return (
    <button className="cast-card" type="button" onClick={onClick}>
      <div className="cast-card__photo">
        {profileUrl ? (
          <img src={profileUrl} alt={member.name} loading="lazy" />
        ) : (
          <span className="cast-card__initials">
            {(member.name || "?").charAt(0)}
          </span>
        )}
      </div>
      <p className="cast-card__name">{member.name}</p>
      {member.character ? (
        <p className="cast-card__role">{member.character}</p>
      ) : null}
    </button>
  );
}
