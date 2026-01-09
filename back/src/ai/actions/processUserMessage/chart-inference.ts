export type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "radial" | "table" | "none";

export interface ChartConfig {
  type: ChartType;
  xKey?: string;
  yKey?: string;
  columns?: string[];
}

// Determine chart axes from data structure
export function determineChartAxes(
  data: Record<string, unknown>[],
  chartType: ChartType
): ChartConfig {
  if (data.length === 0 || chartType === "none") {
    return { type: chartType };
  }

  const columns = Object.keys(data[0]);

  // For tables, return all columns
  if (chartType === "table") {
    return { type: chartType, columns };
  }

  // Find numeric and non-numeric columns
  const numericColumns = columns.filter((col) => {
    const value = data[0][col];
    return (
      typeof value === "number" ||
      (typeof value === "string" && !Number.isNaN(Number(value)))
    );
  });
  const categoryColumns = columns.filter(
    (col) => !numericColumns.includes(col)
  );

  // Determine keys based on chart type
  let xKey: string | undefined;
  let yKey: string | undefined;

  if (chartType === "line" || chartType === "area") {
    // For time-series charts, prefer time/date columns (check both numeric and category)
    // Check numeric columns first (hour, year, etc.)
    const numericTimeCol = numericColumns.find(
      (c) =>
        c === "hour" ||
        c === "day" ||
        c === "month" ||
        c === "year" ||
        c === "week"
    );

    // Check category columns for date/time strings
    const categoryTimeCol = categoryColumns.find(
      (c) =>
        c.includes("date") ||
        c.includes("time") ||
        c.includes("day") ||
        c.includes("hour") ||
        c.includes("month") ||
        c.includes("week")
    );

    xKey = numericTimeCol || categoryTimeCol || categoryColumns[0];

    // For Y-axis, pick the first numeric column that's NOT the X-axis
    yKey = numericColumns.find((c) => c !== xKey) || numericColumns[0];
  } else if (chartType === "bar" || chartType === "pie") {
    // For categorical charts
    xKey = categoryColumns[0] || columns[0];
    // For Y-axis, pick a numeric column that's NOT the X-axis
    yKey = numericColumns.find((c) => c !== xKey) || numericColumns[0] || columns[1];
  } else if (chartType === "radar") {
    // Radar charts use label and value
    xKey = categoryColumns[0];
    yKey = numericColumns[0];
  } else if (chartType === "radial") {
    // Radial charts typically show single metrics
    xKey = categoryColumns[0];
    yKey = numericColumns[0];
  }

  return {
    type: chartType,
    xKey,
    yKey,
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
      if (key.endsWith("_cents")) {
        // Handle both string and number cents values
        const numValue =
          typeof value === "number" ? value : Number.parseFloat(String(value));
        const dollarKey = key.replace("_cents", "");
        formatted[dollarKey] = Number.isNaN(numValue) ? value : numValue / 100;
      } else if (typeof value === "string" && !Number.isNaN(Number(value))) {
        // Convert numeric strings to numbers
        formatted[key] = Number.parseFloat(value);
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
