"use client";

import { useState, useMemo } from "react";
import { Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  BarChart,
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

export function ChartMessage({ charts }: ChartMessageProps) {
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
      <Card className="w-fit max-w-[900px] relative">
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSaveModalOpen(true)}
          >
            <Save className="mr-1 h-4 w-4" />
            Save Widget
          </Button>
        </div>

        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {charts.map((chart, index) => (
              <div key={index} className="w-[400px]">
                <h3 className="mb-2 text-sm font-medium">
                  {getChartTitle(chart.type)}
                </h3>
                {renderChart(chart)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <SaveWidgetModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        charts={widgetCharts}
      />
    </>
  );
}

function getChartTitle(chartType: string): string {
  const titles: Record<string, string> = {
    area: "Area Chart",
    bar: "Bar Chart",
    line: "Line Chart",
    pie: "Pie Chart",
    radar: "Radar Chart",
    radial: "Radial Chart",
  };
  return titles[chartType] || "Chart";
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
  }
}
