import { executeQuery } from "./index.js";

interface DatabaseMetadata {
  locationNames: string[];
  categoryNames: string[];
  // Can add more as needed
}

let cachedMetadata: DatabaseMetadata | null = null;

export async function initializeMetadata(): Promise<void> {
  console.log("🔄 Loading database metadata...");

  try {
    // Query location names
    const locations = await executeQuery<{ name: string }>(
      "SELECT DISTINCT name FROM locations ORDER BY name"
    );

    // Query category names
    const categories = await executeQuery<{ name: string }>(
      "SELECT DISTINCT name FROM categories ORDER BY name"
    );

    cachedMetadata = {
      locationNames: locations.map((l) => l.name),
      categoryNames: categories.map((c) => c.name),
    };

    console.log("✅ Database metadata loaded:");
    console.log(`   Locations: ${cachedMetadata.locationNames.join(", ")}`);
    console.log(`   Categories: ${cachedMetadata.categoryNames.join(", ")}`);
  } catch (error) {
    console.error("❌ Failed to load database metadata:", error);
    // Set empty defaults so the app can still run
    cachedMetadata = {
      locationNames: [],
      categoryNames: [],
    };
  }
}

export function getMetadata(): DatabaseMetadata {
  if (!cachedMetadata) {
    throw new Error(
      "Database metadata not initialized. Call initializeMetadata() first."
    );
  }
  return cachedMetadata;
}
