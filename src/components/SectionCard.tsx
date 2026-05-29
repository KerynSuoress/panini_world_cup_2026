import type { Section, SectionStats } from "../lib/types";

interface SectionCardProps {
  section: Section;
  stats: SectionStats;
  compact?: boolean;
}

export default function SectionCard({ section, stats, compact }: SectionCardProps) {
  const primary = section.colors?.primary ?? "#1B3FA0";

  return (
    <div
      className={`rounded-3xl border border-white/60 bg-white/50 shadow-sm backdrop-blur-xl transition-all hover:bg-white/60 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-bold leading-tight text-gray-800 drop-shadow-sm">{section.name}</p>
          {!compact && section.group && (
            <p className="text-xs font-medium text-gray-500">Group {section.group}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-black tabular-nums drop-shadow-sm" style={{ color: primary }}>
            {stats.percent}%
          </p>
          <p className="text-xs font-medium text-gray-500">
            {stats.owned}/{stats.total}
          </p>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/10 shadow-inner">
        <div
          className="h-full rounded-full transition-all shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{ width: `${stats.percent}%`, backgroundColor: primary }}
        />
      </div>
      {stats.repeats > 0 && (
        <p className="mt-2 text-xs font-bold text-yellow-700 drop-shadow-sm">
          {stats.repeats} repeats for trade
        </p>
      )}
    </div>
  );
}
