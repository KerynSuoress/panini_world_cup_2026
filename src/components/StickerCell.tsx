import React from "react";

interface StickerCellProps {
  number: string;
  type: string;
  wide?: boolean;
  label?: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function StickerCell({
  number,
  type,
  wide,
  label,
  count,
  onIncrement,
  onDecrement,
}: StickerCellProps) {
  const shortLabel =
    type === "shield"
      ? "Shield"
      : type === "teamphoto"
        ? "Team Photo"
        : label?.split(" ").slice(-1)[0] ?? "";

  const isOwned = count > 0;
  const isDuplicate = count > 1;

  // backdrop-blur is intentionally absent here — with ~994 cells on the page
  // each blur creates its own compositing layer, which tanks GPU memory and
  // frame rate. Higher opacity compensates visually.
  let bgClass = "bg-white/75 border-white/70 text-gray-800";
  if (isDuplicate) {
    bgClass = "bg-[var(--color-accent-yellow)]/85 border-yellow-200/80 text-yellow-900";
  } else if (isOwned) {
    bgClass = "bg-[var(--color-accent-green)]/85 border-green-200/80 text-green-900";
  }

  return (
    <div
      className={`relative flex min-h-[5rem] flex-col items-center justify-center rounded-xl border shadow-sm transition-colors ${
        wide ? "col-span-2 sm:col-span-2" : ""
      } ${bgClass}`}
    >
      {/* Main clickable area for incrementing */}
      <button
        type="button"
        onClick={onIncrement}
        className="absolute inset-0 w-full h-full rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        aria-label={`Mark ${number} as owned or add duplicate`}
      />

      <span className="pointer-events-none text-[11px] font-bold uppercase tracking-wide opacity-90">
        {number}
      </span>
      
      {shortLabel && (
        <span className="pointer-events-none mt-0.5 line-clamp-2 text-[9px] leading-tight opacity-75">
          {shortLabel}
        </span>
      )}

      {/* Counter Badge */}
      {isOwned && (
        <div className="pointer-events-none absolute right-1.5 top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-black/20 px-1.5 text-[10px] font-black text-black drop-shadow-sm">
          {count}
        </div>
      )}

      {/* Decrement Button */}
      {isOwned && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDecrement();
          }}
          className="absolute bottom-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-black shadow-sm transition-colors active:scale-90"
          aria-label="Remove one"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}
    </div>
  );
}
