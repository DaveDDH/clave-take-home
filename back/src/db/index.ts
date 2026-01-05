import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export function isReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Must start with SELECT
  if (!normalized.startsWith("SELECT")) {
    return false;
  }

  // Check for dangerous keywords using word boundaries
  // This prevents false positives like "UPDATE" matching "updated_at"
  const dangerousPatterns = [
    /\bINSERT\b/,
    /\bUPDATE\b/,
    /\bDELETE\b/,
    /\bDROP\b/,
    /\bALTER\b/,
    /\bTRUNCATE\b/,
    /\bCREATE\b/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  return true;
}
