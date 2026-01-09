export type ChartType = "bar" | "line" | "area" | "pie" | "radar" | "radial" | "table" | "none";

export interface ChartConfig {
  type: ChartType;
  xKey?: string;
  yKey?: string;
  columns?: string[];
}

interface ColumnClassification {
  numeric: string[];
  category: string[];
}

const TIME_COLUMN_NAMES = ["hour", "day", "month", "year", "week"];
const TIME_COLUMN_PATTERNS = ["date", "time", "day", "hour", "month", "week"];

function classifyColumns(data: Record<string, unknown>[], columns: string[]): ColumnClassification {
  const numeric = columns.filter((col) => {
    const value = data[0][col];
    return (
      typeof value === "number" ||
      (typeof value === "string" && !Number.isNaN(Number(value)))
    );
  });
  const category = columns.filter((col) => !numeric.includes(col));
  return { numeric, category };
}

function findTimeSeriesAxes(
  numericColumns: string[],
  categoryColumns: string[],
  columns: string[]
): { xKey: string | undefined; yKey: string | undefined } {
  // Check numeric columns first (hour, year, etc.)
  const numericTimeCol = numericColumns.find((c) => TIME_COLUMN_NAMES.includes(c));

  // Check category columns for date/time strings
  const categoryTimeCol = categoryColumns.find((c) =>
    TIME_COLUMN_PATTERNS.some((pattern) => c.includes(pattern))
  );

  const xKey = numericTimeCol || categoryTimeCol || categoryColumns[0] || columns[0];
  const yKey = numericColumns.find((c) => c !== xKey) || numericColumns[0];

  return { xKey, yKey };
}

function findCategoricalAxes(
  numericColumns: string[],
  categoryColumns: string[],
  columns: string[]
): { xKey: string | undefined; yKey: string | undefined } {
  const xKey = categoryColumns[0] || columns[0];
  const yKey = numericColumns.find((c) => c !== xKey) || numericColumns[0] || columns[1];
  return { xKey, yKey };
}

function findRadarAxes(
  numericColumns: string[],
  categoryColumns: string[]
): { xKey: string | undefined; yKey: string | undefined } {
  return { xKey: categoryColumns[0], yKey: numericColumns[0] };
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

  if (chartType === "table") {
    return { type: chartType, columns };
  }

  const { numeric: numericColumns, category: categoryColumns } = classifyColumns(data, columns);

  let axes: { xKey: string | undefined; yKey: string | undefined };

  if (chartType === "line" || chartType === "area") {
    axes = findTimeSeriesAxes(numericColumns, categoryColumns, columns);
  } else if (chartType === "bar" || chartType === "pie") {
    axes = findCategoricalAxes(numericColumns, categoryColumns, columns);
  } else {
    axes = findRadarAxes(numericColumns, categoryColumns);
  }

  return {
    type: chartType,
    xKey: axes.xKey,
    yKey: axes.yKey,
  };
}

function formatValue(key: string, value: unknown): { key: string; value: unknown } {
  if (key.endsWith("_cents")) {
    const numValue = typeof value === "number" ? value : Number.parseFloat(String(value));
    const dollarKey = key.replace("_cents", "");
    return { key: dollarKey, value: Number.isNaN(numValue) ? value : numValue / 100 };
  }

  if (typeof value === "string" && !Number.isNaN(Number(value))) {
    return { key, value: Number.parseFloat(value) };
  }

  return { key, value };
}

function applyPieChartMapping(
  formatted: Record<string, unknown>,
  row: Record<string, unknown>,
  chartConfig: ChartConfig
): void {
  if (chartConfig.type !== "pie" || !chartConfig.xKey || !chartConfig.yKey) {
    return;
  }

  if (chartConfig.xKey !== "name") {
    formatted["name"] = formatted[chartConfig.xKey] ?? row[chartConfig.xKey];
  }
  if (chartConfig.yKey !== "value") {
    formatted["value"] = formatted[chartConfig.yKey] ?? row[chartConfig.yKey];
  }
}

// Format data for charts (converts cents to dollars, normalizes pie chart structure)
export function formatDataForChart(
  data: Record<string, unknown>[],
  chartConfig: ChartConfig
): Record<string, unknown>[] {
  return data.map((row) => {
    const formatted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      const { key: newKey, value: newValue } = formatValue(key, value);
      formatted[newKey] = newValue;
    }

    applyPieChartMapping(formatted, row, chartConfig);

    return formatted;
  });
}
