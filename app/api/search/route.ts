// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EXPECTED_DIMENSIONS = 768;
const MATCH_COUNT = 5;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const SearchRequestSchema = z.object({
  query: z.string().trim().min(1, "query cannot be empty").max(500, "query too long"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error(`[search] validation failed: ${parsed.error.message}`);
    return NextResponse.json({ error: "Invalid request", details: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { query } = parsed.data;
  console.log(`[search] query="${query}"`);

  let queryEmbedding: number[];
  try {
    const result = await embed({
      model: google.embeddingModel(EMBEDDING_MODEL),
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: EXPECTED_DIMENSIONS,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });
    queryEmbedding = result.embedding;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`[search] embedding call failed: ${raw}`);
    const isQuota = raw.includes("429") || raw.toLowerCase().includes("quota");
    return NextResponse.json({ error: isQuota ? "Embedding quota/rate limit exceeded" : "Embedding provider failed" }, { status: isQuota ? 429 : 502 });
  }

  if (queryEmbedding.length !== EXPECTED_DIMENSIONS) {
    console.error(`[search] dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${queryEmbedding.length}`);
    return NextResponse.json({ error: "Internal embedding configuration error" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: MATCH_COUNT,
  });

  if (error) {
    console.error(`[search] supabase rpc failed: ${error.message}`);
    return NextResponse.json({ error: "Search query failed" }, { status: 500 });
  }

  console.log(`[search] ${data?.length ?? 0} results returned`);

  const results = (data ?? []).map((row: { filename: string; content: string; similarity: number }) => ({
    filename: row.filename,
    similarity: row.similarity,
    snippet: row.content.slice(0, 300),
  }));

  return NextResponse.json({ query, results });
}
