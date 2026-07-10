import { useState, useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $session, clearSession } from "../store/profileStore";
import { resetPersistence } from "../store/persistence";

interface NavigationProps {
  title: string;
  activeTab: "grid" | "repeats" | "dashboard" | "exchange" | "data" | "history";
}

const tabs = [
  { id: "grid" as const, label: "Album", href: "/grid" },
  { id: "repeats" as const, label: "Repeats", href: "/repeats" },
  { id: "dashboard" as const, label: "Analytics", href: "/dashboard" },
  { id: "exchange" as const, label: "Exchange", href: "/exchange" },
  { id: "history" as const, label: "History", href: "/history" },
  { id: "data" as const, label: "Data Sync", href: "/data" },
];

export default function Navigation({ title, activeTab }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [incomingTradeCount, setIncomingTradeCount] = useState(0);
  const session = useStore($session);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const onCounts = (e: Event) => {
      const detail = (e as CustomEvent<{ incomingPending: number }>).detail;
      setIncomingTradeCount(detail?.incomingPending ?? 0);
    };
    window.addEventListener("panini-trade-counts", onCounts);
    return () => window.removeEventListener("panini-trade-counts", onCounts);
  }, []);

  useEffect(() => {
    if (!session?.profileId) {
      setIncomingTradeCount(0);
      return;
    }
    fetch(`/api/trade-requests?profileId=${session.profileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.counts?.incomingPending != null) {
          setIncomingTradeCount(data.counts.incomingPending);
        }
      })
      .catch(() => {});
  }, [session?.profileId]);

  const switchProfile = () => {
    clearSession();
    resetPersistence();
    // Reload so AppInit re-runs and shows the picker fresh
    window.location.reload();
  };

  const displayName = isMounted && session?.email ? session.email.split('@')[0] : null;

  // Close menu on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* will-change-transform promotes the header to its own GPU compositing
          layer. With the element on its own layer, backdrop-blur-md (12px)
          costs a fraction of the original backdrop-blur-xl (24px) because:
            - Smaller radius = smaller sample area for the GPU
            - Dedicated layer = browser doesn't repaint header + page together
          backdrop-saturate-150 is the Apple liquid-glass trick: boosting
          saturation makes underlying colors read through vividly even at
          lower blur radii. */}
      <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-white/30 px-5 py-3 backdrop-blur-md backdrop-saturate-150 shadow-sm will-change-transform md:px-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo + year */}
        <div className="flex items-center gap-3">
          <img
            src="https://cdn.worldvectorlogo.com/logos/panini-logo.svg"
            alt="Panini"
            className="h-8 w-auto"
          />
          <span className="hidden md:block text-lg font-black tracking-tight text-[var(--color-primary)]">
            2026
          </span>
        </div>

        {/* Desktop inline tabs — hidden on mobile */}
        <nav className="hidden md:block">
          <ul className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const showTradeBadge = tab.id === "exchange" && incomingTradeCount > 0;
              return (
                <li key={tab.id}>
                  <a
                    href={tab.href}
                    className={`relative block rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                      isActive
                        ? "bg-[var(--color-primary)] text-white shadow-md"
                        : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-[var(--color-primary)]"
                    }`}
                  >
                    {tab.label}
                    {showTradeBadge && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent-teal)] ring-2 ring-white" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Profile badge — shown when session exists */}
        {displayName && (
          <button
            type="button"
            onClick={switchProfile}
            className="hidden md:flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm ring-1 ring-white/60 transition-all hover:bg-white/90 hover:text-[var(--color-primary)]"
            title={`Signed in as ${session?.email} — click to switch`}
          >
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent-green)]" />
            {displayName}
          </button>
        )}

        {/* Mobile hamburger — hidden on desktop */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 shadow-sm ring-1 ring-white/60 transition-all hover:bg-white/80 active:scale-95 md:hidden"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        </div>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-64 transform bg-white/90 backdrop-blur-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
          <h2 className="text-lg font-black text-[var(--color-primary)]">Menu</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-600 transition-colors hover:bg-black/10 hover:text-black"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const showTradeBadge = tab.id === "exchange" && incomingTradeCount > 0;
              return (
                <li key={tab.id}>
                  <a
                    href={tab.href}
                    className={`relative block rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                      isActive
                        ? "bg-[var(--color-primary)] text-white shadow-md"
                        : "text-gray-700 hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    {tab.label}
                    {showTradeBadge && (
                      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[var(--color-accent-teal)] ring-2 ring-white" />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>

          {displayName && (
            <div className="mt-6 border-t border-black/5 pt-4">
              <p className="mb-2 px-1 text-xs text-gray-400">{session?.email}</p>
              <button
                type="button"
                onClick={switchProfile}
                className="w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-gray-600 transition-all hover:bg-white hover:shadow-sm"
              >
                Switch profile
              </button>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
