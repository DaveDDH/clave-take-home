import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(sql);

    // Handle multiple statements (returns array of Results)
    if (Array.isArray(result)) {
      // Return rows from the last statement (most likely the main query)
      const lastResult = result.at(-1);
      if (lastResult?.rows) {
        return lastResult.rows as T[];
      }
      console.error('[executeQuery] Multi-statement query returned no usable results:', { sql: sql.slice(0, 200) });
      return [];
    }

    // Safety check: ensure result.rows exists
    if (!result?.rows) {
      console.error('[executeQuery] Unexpected result format:', { result, sql: sql.slice(0, 200) });
      return [];
    }
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE) with parameterized values.
 * Returns rows if the query uses RETURNING clause.
 */
export async function executeWriteQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

export function isReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
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
