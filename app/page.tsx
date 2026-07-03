// app/page.tsx
"use client";

import { useState } from "react";
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

type SearchResult = {
  filename: string;
  similarity: number;
  snippet: string;
};

const STARS = Array.from({ length: 28 }, (_, i) => ({
  top: (i * 37) % 100,
  left: (i * 71) % 100,
  delay: (i * 0.37) % 4,
  size: i % 3 === 0 ? 2 : 1,
}));

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The search failed to return.");
        setResults([]);
        return;
      }
      setResults(data.results);
    } catch {
      setError("Could not reach the search endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${cinzel.variable} ${inter.variable} ${mono.variable} relative min-h-screen overflow-hidden bg-[#030304] font-[family-name:var(--font-body)] text-[#F5F3FF]`}>
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] animate-[drift_22s_ease-in-out_infinite] rounded-full bg-[#9D5CFF] opacity-20 blur-[110px]" />
        <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] animate-[drift_26s_ease-in-out_infinite_reverse] rounded-full bg-[#FF5CA8] opacity-20 blur-[110px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] animate-[drift_30s_ease-in-out_infinite] rounded-full bg-[#FF7A45] opacity-[0.14] blur-[110px]" />

        {/* Star field */}
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#F5F3FF] animate-[twinkle_4s_ease-in-out_infinite]"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 py-24">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-wide sm:text-5xl">
          <span className="bg-gradient-to-r from-[#FF7A45] via-[#FF5CA8] to-[#9D5CFF] bg-clip-text text-transparent animate-[shimmer_6s_ease-in-out_infinite] bg-[length:200%_auto]">The Archive Speaks</span>
        </h1>
        <p className="mt-3 text-sm text-[#A79BC9]">Ask, and the ledger of databases will answer in kind.</p>

        {/* Search input with rotating seal border */}
        <div className="relative mt-10 w-full">
          {/* Search input — replaced rotating ring with static glow */}
          <div className="relative mt-10 w-full">
            <div className="flex items-center gap-2 rounded-full bg-[#0A0A0D] p-1.5 shadow-[0_0_24px_rgba(157,92,255,0.15)] ring-1 ring-white/10 focus-within:shadow-[0_0_28px_rgba(255,92,168,0.25)] focus-within:ring-white/20 transition-shadow duration-300">
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="in-memory key-value store..." maxLength={500} className="w-full rounded-full bg-transparent px-5 py-3 text-sm text-[#F5F3FF] placeholder:italic placeholder:text-[#5C5470] focus:outline-none" />
              <button onClick={handleSearch} disabled={loading || !query.trim()} className="shrink-0 rounded-full bg-gradient-to-r from-[#FF7A45] via-[#FF5CA8] to-[#9D5CFF] px-6 py-3 text-sm font-semibold text-black transition-opacity disabled:opacity-40 hover:opacity-90">
                {loading ? "Casting…" : "Search"}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="mt-6 font-[family-name:var(--font-mono)] text-sm text-[#FF5CA8]">✦ {error}</p>}

        {hasSearched && !loading && !error && results.length === 0 && <p className="mt-10 text-sm text-[#5C5470]">The archive holds nothing that answers this. Try another phrasing.</p>}

        {/* Results */}
        <ul className="mt-12 flex w-full flex-col gap-5">
          {results.map((r, i) => (
            <li key={r.filename} className="group relative animate-[reveal_0.5s_ease-out_both] rounded-2xl" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="relative rounded-2xl border border-white/5 bg-[#0A0A0D]/90 p-5 backdrop-blur transition-shadow duration-300 group-hover:shadow-[0_0_30px_rgba(157,0,255,0.25)] group-hover:border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-[family-name:var(--font-mono)] text-sm text-[#F5F3FF]">{r.filename}</span>
                  <ManaMeter value={r.similarity} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#A79BC9]">{r.snippet}…</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <style jsx global>{`
        @keyframes drift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(40px, -30px) scale(1.08);
          }
        }
        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.9;
          }
        }
        @keyframes shimmer {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        @keyframes reveal {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </main>
  );
}

function ManaMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="font-[family-name:var(--font-mono)] text-xs text-[#5C5470]">{value.toFixed(3)}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#FF7A45] via-[#FF5CA8] to-[#9D5CFF]" style={{ width: `${pct}%`, boxShadow: "0 0 8px rgba(255,92,168,0.6)" }} />
      </div>
    </div>
  );
}
