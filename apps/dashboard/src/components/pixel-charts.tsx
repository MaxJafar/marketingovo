/**
 * Charts drawn to the same rules as the rest of the console: square caps,
 * mitred joins, integer geometry, no curve smoothing and no gradient fills.
 * Everything is inline SVG so it inherits the palette and needs no runtime.
 *
 * Each of these renders whatever series it is handed, including an empty one —
 * panels above decide what "no data" should say, and never rely on a chart to
 * quietly disappear.
 */

export interface SparkBarsProps {
  values: number[];
  accent?: "pink" | "cyan";
  width?: number;
  height?: number;
}

/** The stubby bar histogram tucked beside each KPI number. */
export function SparkBars({
  values,
  accent = "pink",
  width = 84,
  height = 30,
}: SparkBarsProps) {
  if (values.length === 0) return null;
  const colour = accent === "pink" ? "var(--px-pink)" : "var(--px-cyan)";
  const peak = Math.max(...values, 1);
  const slot = width / values.length;
  const barWidth = Math.max(2, Math.floor(slot) - 2);

  return (
    <svg
      className="pixel-chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {values.map((value, index) => {
        // One pixel minimum: a zero-height bar reads as a rendering bug, while
        // a single row of pixels reads correctly as "almost nothing happened".
        const barHeight = Math.max(1, Math.round((value / peak) * height));
        return (
          <rect
            key={index}
            x={Math.round(index * slot)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill={colour}
          />
        );
      })}
    </svg>
  );
}

export interface PixelDonutProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
}

/** The domain-health ring. Pink is the score, cyan is the remainder. */
export function PixelDonut({
  value,
  max = 100,
  size = 132,
  label,
}: PixelDonutProps) {
  const ratio = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="pixel-donut" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          label ?? `Score ${Math.round(value)} out of ${Math.round(max)}`
        }
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--px-cyan)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--px-pink)"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pixel-donut-label" aria-hidden="true">
        <strong className="pixel-donut-score">{Math.round(value)}</strong>
        <span className="pixel-donut-max">/{Math.round(max)}</span>
      </span>
    </div>
  );
}

export interface MeterRowProps {
  name: string;
  value: number | null;
  max?: number;
  suffix?: string;
}

export function MeterRow({ name, value, max = 100, suffix }: MeterRowProps) {
  const known = value !== null && Number.isFinite(value);
  const ratio = known ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="pixel-meter">
      <span className="pixel-meter-name">{name}</span>
      <span className="pixel-meter-value">
        {known
          ? `${Math.round(value)}${suffix ?? `/${Math.round(max)}`}`
          : "no data"}
      </span>
      <span className="pixel-meter-track">
        <span
          className="pixel-meter-fill"
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
}

export interface LineSeries {
  id: string;
  label: string;
  colour: string;
  points: number[];
}

export interface PixelLineChartProps {
  series: LineSeries[];
  xLabels: string[];
  height?: number;
  title: string;
}

/**
 * The mentions trend. Polylines rather than paths, so every vertex sits on an
 * exact coordinate and nothing is interpolated between samples we actually have.
 */
export function PixelLineChart({
  series,
  xLabels,
  height = 168,
  title,
}: PixelLineChartProps) {
  const width = 560;
  const padLeft = 34;
  const padRight = 6;
  const padTop = 8;
  const padBottom = 22;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const allPoints = series.flatMap((entry) => entry.points);
  const peak = Math.max(...allPoints, 1);
  // Round the ceiling up to a friendly number so the gridline labels are
  // readable values rather than whatever the maximum sample happened to be.
  const ceiling = niceCeiling(peak);
  const rows = 4;
  const longest = Math.max(...series.map((entry) => entry.points.length), 1);

  const xAt = (index: number): number =>
    padLeft +
    (longest === 1 ? plotWidth / 2 : (index / (longest - 1)) * plotWidth);
  const yAt = (value: number): number =>
    padTop + plotHeight - (value / ceiling) * plotHeight;

  return (
    <svg
      className="pixel-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      {Array.from({ length: rows + 1 }, (_, row) => {
        const value = (ceiling / rows) * row;
        const y = yAt(value);
        return (
          <g key={row}>
            <line
              className="pixel-chart-grid"
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
            />
            <text className="pixel-chart-axis" x={0} y={y + 3.5}>
              {formatAxis(value)}
            </text>
          </g>
        );
      })}

      {series.map((entry) => (
        <polyline
          key={entry.id}
          fill="none"
          stroke={entry.colour}
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          points={entry.points
            .map((value, index) => `${xAt(index)},${yAt(value)}`)
            .join(" ")}
        />
      ))}

      {xLabels.map((label, index) => {
        const position =
          xLabels.length === 1
            ? padLeft + plotWidth / 2
            : padLeft + (index / (xLabels.length - 1)) * plotWidth;
        return (
          <text
            key={label}
            className="pixel-chart-axis"
            x={position}
            y={height - 6}
            textAnchor={
              index === 0
                ? "start"
                : index === xLabels.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function niceCeiling(peak: number): number {
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude) * magnitude;
}

function formatAxis(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return `${Math.round(value)}`;
}

function trim(value: number): string {
  return value % 1 === 0 ? `${value}` : value.toFixed(1);
}
