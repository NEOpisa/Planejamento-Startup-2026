import TeamGrid from "@/components/roadmap/TeamGrid";
import RoadmapPhases from "@/components/roadmap/RoadmapPhases";
import GestaoGovernanca from "@/components/roadmap/GestaoGovernanca";

export default function RoadmapPage() {
  return (
    <main className="inner">
      <div className="page-header">
        <span className="section-eyebrow">Agência de Soluções Digitais · Roadmap 2026</span>
        <h1 className="page-heading">
          N<span className="text-accent-nvg">E</span>OVANGUAR<span className="text-accent-nvg">D</span>
        </h1>
        <p className="page-sub">Fase inicial · Soluções digitais · 4 cofundadores · 25% cada</p>
      </div>

      <TeamGrid />

      <div style={{ marginBottom: 64 }}>
        <RoadmapPhases />
      </div>

      <div style={{ marginBottom: 48 }}>
        <GestaoGovernanca />
      </div>
    </main>
  );
}
