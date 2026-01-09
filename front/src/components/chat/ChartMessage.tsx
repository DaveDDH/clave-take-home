"use client";

import { useState, useMemo } from "react";

import { CardContent } from "@/components/ui/card";

import {
  AreaChart,
  BarChart,
  DataTable,
  LineChart,
  PieChart,
  RadarChart,
  RadialChart,
} from "@/components/charts";
import { SaveWidgetModal } from "./SaveWidgetModal";
import type { ChartData } from "@/types/chat";
import type { WidgetChart } from "@/types/widget";

interface ChartMessageProps {
  charts: ChartData[];
}

export function ChartMessage({ charts }: Readonly<ChartMessageProps>) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const widgetCharts = useMemo<WidgetChart[]>(() => {
    return charts.map((chart) => ({
      type: chart.type,
      data: chart.data as never,
      config: chart.config,
    }));
  }, [charts]);

  return (
    <>
      <div className="w-full max-w-[700px] relative pb-3 ml-0">
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-4">
            {charts.map((chart, index) => (
              <div key={`chart-${chart.type}-${index}`} className="w-full mr-24">
                {renderChart(chart)}
              </div>
            ))}
          </div>
        </CardContent>
      </div>
      <SaveWidgetModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        charts={widgetCharts}
      />
    </>
  );
}

function renderChart(chart: ChartData): React.ReactNode {
  switch (chart.type) {
    case "area":
      return (
        <AreaChart
          data={chart.data as never}
          xKey={chart.config?.xKey || "x"}
          yKey={chart.config?.yKey || "y"}
        />
      );
    case "bar":
      return (
        <BarChart
          data={chart.data as never}
          xKey={chart.config?.xKey || "x"}
          yKey={chart.config?.yKey || "y"}
        />
      );
    case "line":
      return (
        <LineChart
          data={chart.data as never}
          xKey={chart.config?.xKey || "x"}
          yKey={chart.config?.yKey || "y"}
        />
      );
    case "pie":
      return <PieChart data={chart.data as never} />;
    case "radar":
      return (
        <RadarChart
          data={chart.data as never}
          labelKey={chart.config?.xKey || "label"}
          valueKey={chart.config?.yKey || "value"}
        />
      );
    case "radial":
      return <RadialChart data={chart.data as never} />;
    case "table":
      return <DataTable data={chart.data as never} columns={chart.config?.columns} />;
  }
}
