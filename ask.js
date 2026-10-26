
import { pool } from "./db.js";
import {
  createQueryEmbedding,
  generateAnswer,
} from "./ai.js";

async function retrieveChunks(question, topK = 5) {
  // Step 1: Convert the user's question into a Gemini embedding.
  const queryEmbedding = await createQueryEmbedding(question);

  // Step 2: Find the most similar document chunks using pgvector.
  const result = await pool.query(
    `SELECT
       id,
       content,
       metadata,
       1 - (embedding <=> $1::vector) AS similarity
     FROM documents
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), topK]
  );

  return result.rows;
}

async function answerQuestion(question) {
  // Step 1: Retrieve relevant document chunks.
  const chunks = await retrieveChunks(question);

  if (chunks.length === 0) {
    console.log(
      "No document chunks found. Run npm run ingest first."
    );
    return;
  }

  // Step 2: Display the retrieved chunks for debugging.
  console.log("\n--- Retrieved chunks ---");

  chunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1}`);
    console.log(
      "Similarity:",
      Number(chunk.similarity).toFixed(4)
    );
    console.log("Source:", chunk.metadata.source);
    console.log(chunk.content);
  });

  // Step 3: Combine retrieved chunks into context.
  const context = chunks
    .map((chunk) => chunk.content)
    .join("\n\n");

  // Step 4: Ask Gemini to generate an answer from the context.
  const answer = await generateAnswer(question, context);

  console.log("\n--- AI Answer ---");
  console.log(answer);
}

// Read the question supplied through the terminal.
const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.log(
    'Usage: npm run ask -- "How many annual leave days do employees get?"'
  );
} else {
  try {
    await answerQuestion(question);
  } catch (error) {
    console.error(
      "Question answering failed:",
      error.message
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
