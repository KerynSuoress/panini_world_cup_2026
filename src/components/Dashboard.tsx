import { useStore } from "@nanostores/react";
import { useMemo } from "react";
import { catalog, computeGlobalStats, computeSectionStats } from "../lib/catalog";
import { $owned, $repeats } from "../store/collectionStore";
import ProgressRing from "./ProgressRing";
import SectionCard from "./SectionCard";

export default function Dashboard() {
  const owned = useStore($owned);
  const repeats = useStore($repeats);

  const global = useMemo(
    () => computeGlobalStats(owned, repeats),
    [owned, repeats],
  );

  const ranked = useMemo(() => {
    return catalog.sections
      .map((section) => ({
        section,
        stats: computeSectionStats(section, owned, repeats),
      }))
      .sort((a, b) => b.stats.percent - a.stats.percent);
  }, [owned, repeats]);

  const almostDone = ranked.filter((r) => r.stats.percent >= 80 && r.stats.percent < 100);
  const topRepeats = useMemo(() => {
    return Object.entries(repeats)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [repeats]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col items-center rounded-3xl bg-white/50 p-6 shadow-lg backdrop-blur-xl ring-1 ring-white/60">
        <ProgressRing percent={global.percent} />
        <p className="mt-3 text-sm font-medium text-gray-600">Overall completion</p>
        <p className="text-4xl font-black text-[var(--color-primary)] drop-shadow-sm">
          {global.percent}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total" value={global.total} />
        <StatCard label="Owned" value={global.owned} color="green" />
        <StatCard label="Missing" value={global.missing} color="red" />
        <StatCard label="Repeats" value={global.totalRepeats} color="yellow" />
      </div>

      {almostDone.length > 0 && (
        <div>
          <h2 className="mb-2 pl-2 text-sm font-bold uppercase tracking-wide text-[var(--color-accent-teal)] drop-shadow-sm">
            Almost done
          </h2>
          <div className="space-y-3">
            {almostDone.map(({ section, stats }) => (
              <SectionCard key={section.slug} section={section} stats={stats} compact />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 pl-2 text-sm font-bold uppercase tracking-wide text-gray-600 drop-shadow-sm">
          Team rankings
        </h2>
        <div className="space-y-3">
          {ranked.map(({ section, stats }) => (
            <SectionCard key={section.slug} section={section} stats={stats} />
          ))}
        </div>
      </div>

      {topRepeats.length > 0 && (
        <div className="rounded-3xl bg-white/50 p-5 shadow-lg backdrop-blur-xl ring-1 ring-white/60">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">
            Top repeats
          </h2>
          <ul className="space-y-2">
            {topRepeats.map(([number, count]) => (
              <li key={number} className="flex justify-between text-sm">
                <span className="font-semibold text-gray-800">{number}</span>
                <span className="rounded-full bg-[var(--color-accent-yellow)]/80 px-2 py-0.5 text-xs font-bold text-yellow-900 shadow-sm">
                  ×{count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red" | "yellow";
}) {
  const bg =
    color === "green"
      ? "bg-[var(--color-accent-green)]/20 text-green-900 border-white/60"
      : color === "red"
        ? "bg-[var(--color-accent-red)]/20 text-red-900 border-white/60"
        : color === "yellow"
          ? "bg-[var(--color-accent-yellow)]/30 text-yellow-900 border-white/60"
          : "bg-[var(--color-primary)]/20 text-blue-900 border-white/60";

  return (
    <div className={`rounded-3xl border p-4 shadow-sm backdrop-blur-md ${bg}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-black tabular-nums drop-shadow-sm">{value}</p>
    </div>
  );
}
