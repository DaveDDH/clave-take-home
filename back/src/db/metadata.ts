import { executeQuery } from "./index.js";

interface DatabaseMetadata {
  locationNames: string[];
  categoryNames: string[];
}

/**
 * Fetches metadata fresh from the database each time.
 * Stateless - no caching, safe for horizontal scaling.
 */
export async function getMetadata(): Promise<DatabaseMetadata> {
  try {
    // Query location names
    const locations = await executeQuery<{ name: string }>(
      "SELECT DISTINCT name FROM locations ORDER BY name"
    );

    // Query category names
    const categories = await executeQuery<{ name: string }>(
      "SELECT DISTINCT name FROM categories ORDER BY name"
    );

    return {
      locationNames: locations.map((l) => l.name),
      categoryNames: categories.map((c) => c.name),
    };
  } catch (error) {
    console.error("Failed to load database metadata:", error);
    // Return empty defaults so the app can still run
    return {
      locationNames: [],
      categoryNames: [],
    };
  }
}
