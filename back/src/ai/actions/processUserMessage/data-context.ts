import { executeQuery } from "#db/index.js";

export interface DataContext {
  orderDateRange: {
    earliest: string;
    latest: string;
  } | null;
}

export async function getDataContext(): Promise<DataContext> {
  try {
    const result = await executeQuery<{
      min_date: string;
      max_date: string;
    }>(
      "SELECT MIN(created_at) as min_date, MAX(created_at) as max_date FROM orders"
    );

    if (result.length > 0 && result[0].min_date && result[0].max_date) {
      return {
        orderDateRange: {
          earliest: result[0].min_date,
          latest: result[0].max_date,
        },
      };
    }
  } catch (error) {
    console.warn("Failed to fetch data context:", error);
  }

  return {
    orderDateRange: null,
  };
}
