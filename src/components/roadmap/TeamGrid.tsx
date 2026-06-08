import { TEAM } from "@/lib/roadmap-data";

export default function TeamGrid() {
  return (
    <>
      <div className="block-label">{"// time"}</div>
      <div className="team-grid">
        {TEAM.map((member) => (
          <div className="team-card" key={member.name}>
            <div className="team-name">{member.name}</div>
            <p className="team-role">{member.role}</p>
            <span className="team-share">{member.share}</span>
          </div>
        ))}
      </div>
    </>
  );
}
