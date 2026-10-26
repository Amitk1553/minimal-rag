
import fs from "node:fs/promises";
import { pool } from "./db.js";
import { createDocumentEmbedding } from "./ai.js";

const FILE_PATH = "./data/company-policy.txt";
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end === text.length) {
      break;
    }

    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

async function ingestDocument() {
  try {
    // Step 1: Read the document.
    const text = await fs.readFile(FILE_PATH, "utf8");

    // Step 2: Split the document into overlapping chunks.
    const chunks = splitIntoChunks(text);

    console.log(`Loaded document: ${FILE_PATH}`);
    console.log(`Created ${chunks.length} chunks`);

    // Step 3: Remove previously ingested chunks from this file.
    await pool.query(
      "DELETE FROM documents WHERE metadata->>'source' = $1",
      ["company-policy.txt"]
    );

    // Step 4: Generate Gemini embeddings and store them in pgvector.
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      console.log(
        `Generating Gemini embedding for chunk ${i + 1}/${chunks.length}...`
      );

      const embedding = await createDocumentEmbedding(chunk);

      await pool.query(
        `INSERT INTO documents (content, embedding, metadata)
         VALUES ($1, $2::vector, $3::jsonb)`,
        [
          chunk,
          JSON.stringify(embedding),
          JSON.stringify({
            source: "company-policy.txt",
            chunkIndex: i,
          }),
        ]
      );

      console.log(`Stored chunk ${i + 1}/${chunks.length}`);
    }

    console.log("Document ingestion completed successfully!");
  } catch (error) {
    console.error("Ingestion failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await ingestDocument();
