import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { readdir, readFile } from "fs/promises";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

// ---- Config ----
const DOCS_DIR = path.join(process.cwd(), "docs");
const EMBEDDING_MODEL = "gemini-embedding-001";
const EXPECTED_DIMENSIONS = 768;

// ---- Fail fast on missing env vars — don't discover this mid-run ----
const REQUIRED_ENV_VARS = ["GOOGLE_GENERATIVE_AI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

type IngestResult = { filename: string; status: "success"; id: string; durationMs: number } | { filename: string; status: "failed"; error: string };

async function ingestFile(filename: string): Promise<IngestResult> {
  const filePath = path.join(DOCS_DIR, filename);
  const start = Date.now();

  console.log(`[START] ${filename}`);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    const msg = `read failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[FAIL]  ${filename} — ${msg}`);
    return { filename, status: "failed", error: msg };
  }

  if (content.trim().length === 0) {
    const msg = "file is empty";
    console.error(`[FAIL]  ${filename} — ${msg}`);
    return { filename, status: "failed", error: msg };
  }

  let embedding: number[];
  try {
    const result = await embed({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      value: content,
      providerOptions: {
        google: {
          outputDimensionality: EXPECTED_DIMENSIONS,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      },
    });
    embedding = result.embedding;
  } catch (err) {
    // Distinguish quota exhaustion from transient rate limiting from other failures.
    // Don't collapse these into one message — you need to know which one you hit.
    const raw = err instanceof Error ? err.message : String(err);
    let msg = `embedding call failed: ${raw}`;
    if (raw.includes("429") || raw.toLowerCase().includes("quota")) {
      msg = `QUOTA/RATE LIMIT (429): ${raw}`;
    }
    console.error(`[FAIL]  ${filename} — ${msg}`);
    return { filename, status: "failed", error: msg };
  }

  if (embedding.length !== EXPECTED_DIMENSIONS) {
    const msg = `dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`;
    console.error(`[FAIL]  ${filename} — ${msg}`);
    return { filename, status: "failed", error: msg };
  }

  console.log(`[DEBUG] ${filename} — embedding generated, dims=${embedding.length}`);

  const { data, error } = await supabase.from("documents").insert({ filename, content, embedding }).select("id").single();

  if (error) {
    const msg = `supabase insert failed: ${error.message}`;
    console.error(`[FAIL]  ${filename} — ${msg}`);
    return { filename, status: "failed", error: msg };
  }

  const durationMs = Date.now() - start;
  console.log(`[OK]    ${filename} — id=${data.id} (${durationMs}ms)`);

  return { filename, status: "success", id: data.id, durationMs };
}

async function main() {
  console.log(`[INFO] Reading docs from: ${DOCS_DIR}`);

  let files: string[];
  try {
    files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".txt"));
  } catch (err) {
    console.error(`[FATAL] Could not read docs directory: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`[FATAL] No .txt files found in ${DOCS_DIR}`);
    process.exit(1);
  }

  console.log(`[INFO] Found ${files.length} files. Ingesting sequentially (free-tier quota discipline).\n`);

  const results: IngestResult[] = [];

  // Sequential, not Promise.all — deliberate. See conversation notes on why.
  for (const filename of files) {
    const result = await ingestFile(filename);
    results.push(result);
  }

  const successes = results.filter((r) => r.status === "success");
  const failures = results.filter((r) => r.status === "failed");

  console.log("\n========== INGESTION SUMMARY ==========");
  console.log(`Total:   ${results.length}`);
  console.log(`Success: ${successes.length}`);
  console.log(`Failed:  ${failures.length}`);

  if (failures.length > 0) {
    console.log("\nFailed files:");
    for (const f of failures) {
      if (f.status === "failed") console.log(`  - ${f.filename}: ${f.error}`);
    }
  }
  console.log("========================================\n");

  if (failures.length > 0) {
    process.exitCode = 1; // non-zero exit so CI or a wrapper script can detect partial failure
  }
}

main();
