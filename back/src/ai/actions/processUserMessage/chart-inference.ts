export type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "radial";

export interface ChartConfig {
  type: ChartType;
  xKey?: string;
  yKey?: string;
}

export function inferChartType(
  data: Record<string, unknown>[],
  userQuestion: string
): ChartConfig {
  if (data.length === 0) {
    return { type: "bar" };
  }

  const columns = Object.keys(data[0]);
  const questionLower = userQuestion.toLowerCase();

  // Find numeric and non-numeric columns
  const numericColumns = columns.filter((col) => {
    const value = data[0][col];
    return (
      typeof value === "number" ||
      (typeof value === "string" && !isNaN(Number(value)))
    );
  });
  const categoryColumns = columns.filter((col) => !numericColumns.includes(col));

  // Time-based questions -> line chart
  if (
    questionLower.includes("over time") ||
    questionLower.includes("trend") ||
    questionLower.includes("daily") ||
    questionLower.includes("weekly") ||
    questionLower.includes("monthly") ||
    questionLower.includes("hourly") ||
    questionLower.includes("by day") ||
    questionLower.includes("by week") ||
    questionLower.includes("by month") ||
    questionLower.includes("by hour")
  ) {
    const timeCol =
      categoryColumns.find(
        (c) =>
          c.includes("date") ||
          c.includes("time") ||
          c.includes("day") ||
          c.includes("hour") ||
          c.includes("month") ||
          c.includes("week")
      ) || categoryColumns[0];
    return {
      type: "line",
      xKey: timeCol,
      yKey: numericColumns[0],
    };
  }

  // Distribution/breakdown questions -> pie chart
  if (
    questionLower.includes("breakdown") ||
    questionLower.includes("distribution") ||
    questionLower.includes("proportion") ||
    questionLower.includes("percentage") ||
    questionLower.includes("share")
  ) {
    return {
      type: "pie",
      xKey: categoryColumns[0],
      yKey: numericColumns[0],
    };
  }

  // Comparison questions -> bar chart (default)
  if (
    questionLower.includes("compare") ||
    questionLower.includes("comparison") ||
    questionLower.includes("top") ||
    questionLower.includes("best") ||
    questionLower.includes("worst") ||
    questionLower.includes("most") ||
    questionLower.includes("least") ||
    questionLower.includes("by location") ||
    questionLower.includes("by category") ||
    questionLower.includes("by product") ||
    questionLower.includes("by source")
  ) {
    return {
      type: "bar",
      xKey: categoryColumns[0],
      yKey: numericColumns[0],
    };
  }

  // Default to bar chart
  return {
    type: "bar",
    xKey: categoryColumns[0] || columns[0],
    yKey: numericColumns[0] || columns[1],
  };
}

// Format data for pie charts (needs name/value structure)
export function formatDataForChart(
  data: Record<string, unknown>[],
  chartConfig: ChartConfig
): Record<string, unknown>[] {
  // Convert cents to dollars for display
  return data.map((row) => {
    const formatted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key.endsWith("_cents") && typeof value === "number") {
        const dollarKey = key.replace("_cents", "");
        formatted[dollarKey] = value / 100;
      } else {
        formatted[key] = value;
      }
    }

    // For pie charts, rename keys to name/value if needed
    if (chartConfig.type === "pie" && chartConfig.xKey && chartConfig.yKey) {
      if (chartConfig.xKey !== "name") {
        formatted["name"] = formatted[chartConfig.xKey] ?? row[chartConfig.xKey];
      }
      if (chartConfig.yKey !== "value") {
        formatted["value"] = formatted[chartConfig.yKey] ?? row[chartConfig.yKey];
      }
    }

    return formatted;
  });
}
