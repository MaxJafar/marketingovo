import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { BarSeriesOption, ComposeOption } from "echarts";
import type { ComparisonReport } from "@golem-intel/sdk";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type ChartOption = ComposeOption<
  BarSeriesOption | GridComponentOption | TooltipComponentOption
>;

interface MetricChartProps {
  report: ComparisonReport;
}

export function MetricChart({ report }: MetricChartProps): React.JSX.Element {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const chart = echarts.init(element, undefined, { renderer: "canvas" });
    const option: ChartOption = {
      backgroundColor: "transparent",
      grid: { left: 8, right: 12, top: 24, bottom: 12, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#121824",
        borderColor: "#2b3547",
        textStyle: { color: "#f4f7fb" },
      },
      xAxis: {
        type: "category",
        data: report.targets.map((target) => target.entity_name),
        axisLabel: { color: "#91a0b7" },
        axisLine: { lineStyle: { color: "#2b3547" } },
      },
      yAxis: {
        type: "value",
        name: "Follower Δ",
        nameTextStyle: { color: "#718097" },
        axisLabel: { color: "#91a0b7" },
        splitLine: { lineStyle: { color: "#1d2635" } },
      },
      series: [
        {
          type: "bar",
          data: report.targets.map((target) => ({
            value: target.follower_delta,
            itemStyle: {
              color: target.follower_delta >= 0 ? "#61e7b7" : "#ff7f91",
              borderRadius: [5, 5, 0, 0],
            },
          })),
          barMaxWidth: 48,
        },
      ],
    };
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [report]);

  return (
    <section className="panel metric-panel" aria-labelledby="metric-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">OBSERVED CHANGE</p>
          <h2 id="metric-title">Follower delta</h2>
        </div>
        <span className="definition-chip">followers.v1</span>
      </div>
      <div
        ref={chartRef}
        className="metric-chart"
        role="img"
        aria-label="Follower change by monitored target"
      />
      <p className="chart-note">
        Public follower change is not customer retention or business churn.
      </p>
    </section>
  );
}

