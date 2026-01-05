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
import {
  areaChartData,
  barChartData,
  lineChartData,
  pieChartData,
  radarChartData,
  radialChartData,
} from "@/data";
import { SaveWidgetModal } from "./SaveWidgetModal";
import type { ChartType } from "@/types/chat";
import type { WidgetChart } from "@/types/widget";

interface ChartMessageProps {
  charts: ChartType[];
}

export function ChartMessage({ charts }: ChartMessageProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const widgetCharts = useMemo<WidgetChart[]>(() => {
    return charts.map((chartType) => getWidgetChart(chartType));
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

        <CardContent>
          <div className="flex flex-wrap gap-4">
            {charts.map((chartType) => (
              <div key={chartType} className="w-[220px]">
                <h3 className="mb-2 text-sm font-medium">
                  {getChartTitle(chartType)}
                </h3>
                {renderChart(chartType)}
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

function getChartTitle(chartType: ChartType): string {
  const titles: Record<ChartType, string> = {
    area: "Area Chart",
    bar: "Bar Chart",
    line: "Line Chart",
    pie: "Pie Chart",
    radar: "Radar Chart",
    radial: "Radial Chart",
  };
  return titles[chartType];
}

function renderChart(chartType: ChartType): React.ReactNode {
  switch (chartType) {
    case "area":
      return <AreaChart data={areaChartData} xKey="month" yKey="revenue" />;
    case "bar":
      return <BarChart data={barChartData} xKey="location" yKey="sales" />;
    case "line":
      return <LineChart data={lineChartData} xKey="day" yKey="orders" />;
    case "pie":
      return <PieChart data={pieChartData} />;
    case "radar":
      return (
        <RadarChart
          data={radarChartData}
          labelKey="category"
          valueKey="score"
        />
      );
    case "radial":
      return <RadialChart data={radialChartData} />;
  }
}

function getWidgetChart(chartType: ChartType): WidgetChart {
  switch (chartType) {
    case "area":
      return {
        type: "area",
        data: areaChartData,
        config: { xKey: "month", yKey: "revenue" },
      };
    case "bar":
      return {
        type: "bar",
        data: barChartData,
        config: { xKey: "location", yKey: "sales" },
      };
    case "line":
      return {
        type: "line",
        data: lineChartData,
        config: { xKey: "day", yKey: "orders" },
      };
    case "pie":
      return { type: "pie", data: pieChartData };
    case "radar":
      return {
        type: "radar",
        data: radarChartData,
        config: { labelKey: "category", valueKey: "score" },
      };
    case "radial":
      return { type: "radial", data: radialChartData };
  }
}
