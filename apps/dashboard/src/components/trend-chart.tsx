import type { TrendPoint } from "../api/contracts";
import { Card, EmptyState } from "./ui";

export function TrendChart({
  points,
  title,
}: {
  points: TrendPoint[];
  title: string;
}) {
  const valid = points.filter(
    (point): point is TrendPoint & { value: number } =>
      typeof point.value === "number",
  );
  if (valid.length < 2) {
    return (
      <EmptyState
        title="Trend unavailable"
        description="At least two dated measurements are needed to draw a trustworthy trend."
      />
    );
  }

  const values = valid.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = valid.map((point, index) => {
    const x = 12 + (index / (valid.length - 1)) * 576;
    const y = 176 - ((point.value - min) / range) * 144;
    return `${x},${y}`;
  });

  return (
    <Card className="trend-card">
      <div className="trend-header">
        <div>
          <p className="eyebrow">Historical signal</p>
          <h2>{title}</h2>
        </div>
        <span>{valid.length} observations</span>
      </div>
      <svg
        className="trend-chart"
        viewBox="0 0 600 200"
        role="img"
        aria-label={`${title}, from ${min} to ${max}`}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6558e8" stopOpacity="0.3" />
            <stop offset="1" stopColor="#6558e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="chart-grid"
          d="M12 32H588M12 80H588M12 128H588M12 176H588"
        />
        <polygon
          points={`12,176 ${coordinates.join(" ")} 588,176`}
          fill="url(#trend-fill)"
        />
        <polyline
          points={coordinates.join(" ")}
          fill="none"
          stroke="#6558e8"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {valid.map((point, index) => {
          const [cx, cy] = coordinates[index].split(",");
          return (
            <circle
              key={`${point.date}-${index}`}
              cx={cx}
              cy={cy}
              r="4"
              fill="#fff"
              stroke="#6558e8"
              strokeWidth="3"
            >
              <title>{`${point.date}: ${point.value}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="trend-axis">
        <span>{valid[0].date}</span>
        <span>{valid.at(-1)?.date}</span>
      </div>
    </Card>
  );
}
