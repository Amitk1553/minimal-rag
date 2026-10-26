# Minimal RAG Pipeline with Gemini and pgvector

A minimal **Retrieval-Augmented Generation (RAG)** application built from scratch using Node.js, Google's Gemini API, PostgreSQL, and pgvector — without LangChain or other RAG frameworks.

The project demonstrates how to ingest a text document, generate embeddings, store them in a vector database, retrieve semantically relevant chunks, and use an LLM to answer questions based on the retrieved context.

## Features

- Read and ingest local `.txt` documents.
- Split documents into overlapping text chunks.
- Generate embeddings using Gemini Embedding 2.
- Store document chunks and embeddings in PostgreSQL with pgvector.
- Perform semantic search using cosine distance.
- Retrieve the top-K most relevant chunks for a user question.
- Generate context-aware answers using Gemini 3.8 Flash.
- Display retrieved chunks and similarity scores for debugging.
- Keep the implementation framework-free to understand the internal working of RAG.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Language | JavaScript (ES modules) |
| AI SDK | `@google/genai` |
| Embedding model | `gemini-embedding-2` |
| Answer generation | `gemini-3.8-flash` |
| Database | PostgreSQL |
| Vector search | pgvector |
| PostgreSQL client | `pg` |
| Environment variables | `dotenv` |
| Containerization | Docker Compose |

## How It Works

The project has two main pipelines.

### 1. Document Ingestion

1. Read the source `.txt` document.
2. Split the text into chunks with a configurable overlap.
3. Generate a vector embedding for each chunk using Gemini.
4. Store each chunk, embedding, and metadata in PostgreSQL.
5. Make the document available for semantic retrieval.

### 2. Retrieval and Answer Generation

1. Accept a user's question through the command line.
2. Generate an embedding for the question using Gemini.
3. Compare the question embedding against stored embeddings using pgvector.
4. Retrieve the top-K chunks with the smallest cosine distance.
5. Combine the retrieved text into a context.
6. Send the question and context to Gemini.
7. Display the generated answer and retrieved chunks.

### Architecture

```text
                 DOCUMENT INGESTION

    Text Document (.txt)
            |
            v
       Text Chunking
            |
            v
      Gemini Embeddings
            |
            v
    PostgreSQL + pgvector
            |
            |
            v
             RETRIEVAL

        User Question
            |
            v
      Query Embedding
            |
            v
     pgvector Similarity Search
            |
            v
      Top-K Relevant Chunks
            |
            v
     Question + Retrieved Context
            |
            v
       Gemini LLM
            |
            v
        Final Answer
```

## Project Structure

```text
minimal-rag/
├── data/
│   └── company-policy.txt
├── ai.js
├── ask.js
├── db.js
├── ingest.js
├── schema.sql
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/en/download) — use a supported LTS version.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — with its engine running.
- [Google AI Studio](https://aistudio.google.com/apikey) — to create a Gemini API key.
- Git — to clone or contribute to the repository.

You need Gemini API access and sufficient quota for embedding and answer-generation requests. Availability and limits depend on your API project and usage tier.

## Getting Started

### 1. Clone the repository

Replace `YOUR_USERNAME` with the GitHub account that owns this repository.

```bash
git clone https://github.com/YOUR_USERNAME/minimal-rag.git
cd minimal-rag
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder API key with your own Gemini API key.

```dotenv
GEMINI_API_KEY=your_actual_gemini_api_key
DATABASE_URL=postgresql://raguser:ragpassword@localhost:5432/ragdb
```

Use the database connection string that matches your local Docker Compose configuration.

**Never commit `.env` or share your API key.** The `.env.example` file is only a template.

### 4. Start PostgreSQL with pgvector

Make sure Docker Desktop is running, then execute:

```bash
docker compose up -d
```

Check the container status:

```bash
docker compose ps
```

### 5. Initialize the database schema

From Git Bash, run:

```bash
docker compose exec -T db psql -U raguser -d ragdb < schema.sql
```

This creates the `vector` extension and the `documents` table.

Verify that the table exists:

```bash
docker compose exec db psql -U raguser -d ragdb -c "\dt"
```

### 6. Ingest the document

Make sure `data/company-policy.txt` exists. Then run:

```bash
npm run ingest
```

The ingestion script reads the document, splits it into chunks, generates Gemini embeddings, and stores the results in PostgreSQL.

### 7. Ask a question

Run:

```bash
npm run ask -- "How many annual leave days do employees get?"
```

The program displays the retrieved chunks and their similarity scores, then generates an answer based on the retrieved context.

Try other questions:

```bash
npm run ask -- "What are the sick leave rules?"
npm run ask -- "Can I work remotely?"
npm run ask -- "What is the annual learning budget?"
```

Answers depend on the contents of your ingested document.

## Database Schema

The `documents` table stores the text and the corresponding vector embedding.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The embedding column uses 1,536 dimensions, matching the dimensionality configured in `ai.js`.

## Similarity Search

The retrieval pipeline uses pgvector's cosine-distance operator, `<=>`.

```sql
SELECT
    content,
    1 - (embedding <=> $1::vector) AS similarity
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

The query ranks document chunks by cosine distance and returns the top-K results. The similarity score is derived from cosine distance; it is not a probability or a guarantee that a result answers the question.

## Configuration

The main settings are defined in the source files:

- **`ingest.js`** — document path, chunk size, and chunk overlap.
- **`ai.js`** — Gemini models, embedding dimensionality, and generation settings.
- **`ask.js`** — the number of retrieved chunks (`topK`).
- **`docker-compose.yml`** — PostgreSQL image, local database credentials, port, and persistent storage.
- **`.env`** — API key and database connection string.

The example uses a character-based chunk splitter. This is intended for learning; sentence-aware chunking and more advanced retrieval can be added later.

## Troubleshooting

### PostgreSQL password authentication failed

Check that the credentials in `.env` match the database configuration. If the PostgreSQL volume was initialized earlier, changing the password in Docker Compose will not automatically change the existing database user's password.

### Gemini authentication or quota error

Verify the API key, selected Google AI Studio project, enabled API access, and available quota.

### Embedding dimensions error

Make sure the document and query use the same embedding model and that the generated vector dimensions match `VECTOR(1536)`.

If you change embedding models, re-ingest the documents rather than mixing incompatible embeddings in the same vector search.

### No chunks found

Run `npm run ingest` and check that the source text file exists.

### Stop the database

```bash
docker compose down
```

This stops the container but retains the named database volume.

To remove the database volume and all its stored data, use the following only when you intentionally want a complete reset:

```bash
docker compose down -v
```

## Future Improvements

- Support multiple documents and folders.
- Extract text from PDF and DOCX files.
- Use sentence-aware or token-aware chunking.
- Batch embedding requests and add retry logic.
- Add source citations to generated answers.
- Implement metadata filtering and hybrid search.
- Compare exact vector search with HNSW and IVFFlat indexes.
- Build a REST API with Express.
- Create a frontend for document upload and question answering.
- Evaluate retrieval quality and answer faithfulness with test questions.

## Learning Goals

This project is designed to develop a clear understanding of the RAG process without hiding the implementation behind a framework.

The goal is to understand how chunking, embeddings, vector storage, similarity search, context construction, and LLM generation work together.

## Security Notes

- Keep API keys in `.env`, not in source code.
- Never commit `.env` or other secret files.
- Use `.env.example` to document required environment variables.
- The database credentials in the Docker Compose configuration are for local development only.
- Do not upload confidential or sensitive documents to an external AI API without appropriate authorization.

## References

- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [Gemini embeddings documentation](https://ai.google.dev/gemini-api/docs/embeddings)
- [pgvector repository](https://github.com/pgvector/pgvector)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Node.js documentation](https://nodejs.org/docs/)

---

Built as a hands-on project to understand Retrieval-Augmented Generation from the ground up.
