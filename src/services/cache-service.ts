import { randomUUID, type UUID } from "node:crypto";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { CacheEntry } from "../models/cache.js";
import { config } from "../config.js";

type CacheRow = {
  id: string;
  prompt: string;
  context: string;
  normalizedContext: string;
  contextHash: string;
  embeddings: Buffer;
  response: string;
  chatModel: string;
  embeddingModel: string;
  createdAt: string;
};

export type CacheMatch = {
  entry: CacheEntry;
  distance: number;
};

type SearchOptions = {
  chatModel: string;
  embeddingModel: string;
  limit?: number;
};

/**
 * CacheService is responsible for interacting with SQLite and finding cache matches.
 * Since SQLite does not in itself support vector searching, we need to make use of 
 * an external library, sqlite-vec, in order to get past this. 
 * 
 * This supports exact match statements and semantic matches. The reason why we look for exact-match statements first, is because we 
 * want to go the cheapest path first. If a context is normalised and hashed, and we look for the exact same hash, we know for sure that it is
 * the same relevant conversation context. So therefore, why ask the LLM again when we know that we are going to get the same answer anyways?
 */
export class CacheService {
  private readonly database: Database.Database;
  private readonly insertStatement: Database.Statement;
  private readonly exactMatchStatement: Database.Statement;
  private readonly semanticMatchStatement: Database.Statement;

  constructor() {
    this.database = new Database(config.dbPath);
    sqliteVec.load(this.database);
    this.initTables();

    /**
     * Important to note is that in the SQL schema, we store in three versions: 
     * the actual prompt (for debugging purposes), the entire conversation (context), normalized (without whitespaces and all lowercase so that prompts with 
     * for instance, an extra whitespace or so are treated the same for caching purposes), as well as hashed (for fast lookups). 
     * 
     * A hashed version of the prompt is great to have so that we can avoid comparing long strings when querying.
     * Furthermore, indexes on long text incur a penalty depending on how long the string is, but with a hashed string,
     * everything is fixed-size. 
     */
    this.insertStatement = this.database.prepare(`
      INSERT INTO cache_entries (
        id, prompt, context, normalizedContext, contextHash,
        embeddings, response, chatModel, embeddingModel, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.exactMatchStatement = this.database.prepare(`
      SELECT
        id,
        prompt,
        context,
        normalizedContext,
        contextHash,
        embeddings,
        response,
        chatModel,
        embeddingModel,
        createdAt
      FROM cache_entries
      WHERE contextHash = ?
        AND chatModel = ?
        AND embeddingModel = ?
      LIMIT 1
    `);

    this.semanticMatchStatement = this.database.prepare(`
      SELECT
        id,
        prompt,
        context,
        normalizedContext,
        contextHash,
        embeddings,
        response,
        chatModel,
        embeddingModel,
        createdAt,
        vec_distance_cosine(embeddings, ?) AS distance
      FROM cache_entries
      WHERE chatModel = ?
        AND embeddingModel = ?
      ORDER BY distance ASC
      LIMIT ?
    `);
  }

  public save(entry: CacheEntry) {
    const id = entry.id ?? randomUUID();

    this.insertStatement.run(
      id,
      entry.prompt,
      entry.context,
      entry.normalizedContext,
      entry.contextHash,
      this.embeddingsToBlob(entry.embeddings),
      entry.response,
      entry.chatModel,
      entry.embeddingModel,
      this.toTimestamp(entry.createdAt),
    );

    return id;
  }

  public findExactMatch(
    contextHash: string,
    chatModel: string,
    embeddingModel: string,
  ): CacheEntry | null {
    const row = this.exactMatchStatement.get(contextHash, chatModel, embeddingModel) as CacheRow | undefined;

    return row ? this.rowToEntry(row) : null;
  }

  public findSemanticMatches(
    embeddings: number[],
    options: SearchOptions,
  ): CacheMatch[] {
    const vector = this.embeddingsToBlob(embeddings);
    const rows = this.semanticMatchStatement.all(
      vector,
      options.chatModel,
      options.embeddingModel,
      options.limit ?? 1,
    ) as Array<CacheRow & { distance: number }>;

    return rows.map(row => ({
      entry: this.rowToEntry(row),
      distance: row.distance,
    }));
  }

  public clear() {
    const result = this.database.prepare(`
      DELETE FROM cache_entries
    `).run();

    return result.changes;
  }

  public close() {
    this.database.close();
  }

  private initTables() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        context TEXT NOT NULL,
        normalizedContext TEXT NOT NULL,
        contextHash TEXT NOT NULL,
        embeddings BLOB NOT NULL,
        response TEXT NOT NULL,
        chatModel TEXT NOT NULL,
        embeddingModel TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cache_entries_lookup
        ON cache_entries(contextHash, chatModel, embeddingModel);
    `);
  }

  private embeddingsToBlob(embeddings: number[]) {
    return Buffer.from(new Float32Array(embeddings).buffer);
  }

  private rowToEntry(row: CacheRow): CacheEntry {
    return {
      id: row.id as UUID,
      prompt: row.prompt,
      context: row.context,
      normalizedContext: row.normalizedContext,
      contextHash: row.contextHash,
      embeddings: Array.from(
        new Float32Array(
          row.embeddings.buffer,
          row.embeddings.byteOffset,
          row.embeddings.byteLength / Float32Array.BYTES_PER_ELEMENT,
        ),
      ),
      response: row.response,
      chatModel: row.chatModel,
      embeddingModel: row.embeddingModel,
      createdAt: new Date(row.createdAt),
    };
  }

  private toTimestamp(createdAt: Date) {
    return createdAt.toISOString();
  }
}
