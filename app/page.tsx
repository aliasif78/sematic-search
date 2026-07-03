// app/page.tsx
"use client";

import { useState } from "react";

type SearchResult = {
  filename: string;
  similarity: number;
  snippet: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setResults([]);
        return;
      }
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>Semantic Search — Databases</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="e.g. in-memory key-value store" style={{ width: 400, padding: 8 }} />
      <button onClick={handleSearch} disabled={loading} style={{ marginLeft: 8, padding: 8 }}>
        {loading ? "Searching..." : "Search"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul style={{ marginTop: 24 }}>
        {results.map((r) => (
          <li key={r.filename} style={{ marginBottom: 16 }}>
            <strong>{r.filename}</strong> — similarity: {r.similarity.toFixed(4)}
            <p>{r.snippet}...</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
