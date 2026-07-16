const WEEKDAYS = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

interface ParsedField {
  values: Set<number>;
  unrestricted: boolean;
}

function parseField(
  source: string,
  minimum: number,
  maximum: number,
  normalize?: (value: number) => number,
): ParsedField {
  const unrestricted = source === "*";
  const values = new Set<number>();
  for (const part of source.split(",")) {
    const [rangeSource, stepSource] = part.split("/", 2);
    const step = stepSource === undefined ? 1 : Number(stepSource);
    if (!Number.isInteger(step) || step < 1)
      throw new Error(`Invalid cron step '${part}'`);
    let start: number;
    let end: number;
    if (rangeSource === "*") {
      start = minimum;
      end = maximum;
    } else if (rangeSource?.includes("-")) {
      const [left, right] = rangeSource.split("-", 2).map(Number);
      start = left!;
      end = right!;
    } else {
      start = Number(rangeSource);
      end = start;
    }
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < minimum ||
      end > maximum ||
      end < start
    ) {
      throw new Error(`Invalid cron field '${source}'`);
    }
    for (let value = start; value <= end; value += step)
      values.add(normalize ? normalize(value) : value);
  }
  if (values.size === 0) throw new Error(`Empty cron field '${source}'`);
  return { values, unrestricted };
}

function partsAt(
  date: Date,
  timezone: string,
): {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
} {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      minute: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      day: "2-digit",
      month: "2-digit",
      weekday: "short",
    });
  } catch {
    throw new Error(`Invalid IANA timezone '${timezone}'`);
  }
  const fields = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAYS.get(fields.weekday ?? "");
  if (weekday === undefined)
    throw new Error(`Unable to resolve weekday for '${timezone}'`);
  return {
    minute: Number(fields.minute),
    hour: Number(fields.hour),
    day: Number(fields.day),
    month: Number(fields.month),
    weekday,
  };
}

export function nextCronOccurrence(
  expression: string,
  timezone: string,
  after: Date,
): Date {
  const every = /^@every\s+(\d+)(m|h|d)$/u.exec(expression.trim());
  if (every) {
    const amount = Number(every[1]);
    if (!Number.isInteger(amount) || amount < 1)
      throw new Error("Invalid @every interval");
    const unit =
      every[2] === "m" ? 60_000 : every[2] === "h" ? 3_600_000 : 86_400_000;
    return new Date(after.getTime() + amount * unit);
  }
  const fields = expression.trim().split(/\s+/u);
  if (fields.length !== 5)
    throw new Error("Cron expression must contain five fields");
  const minute = parseField(fields[0]!, 0, 59);
  const hour = parseField(fields[1]!, 0, 23);
  const day = parseField(fields[2]!, 1, 31);
  const month = parseField(fields[3]!, 1, 12);
  const weekday = parseField(fields[4]!, 0, 7, (value) =>
    value === 7 ? 0 : value,
  );
  const candidate = new Date(after.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  const maximumMinutes = 366 * 24 * 60 * 5;
  for (let offset = 0; offset < maximumMinutes; offset += 1) {
    const local = partsAt(candidate, timezone);
    const dayMatches = day.values.has(local.day);
    const weekdayMatches = weekday.values.has(local.weekday);
    const calendarMatches =
      day.unrestricted && weekday.unrestricted
        ? true
        : day.unrestricted
          ? weekdayMatches
          : weekday.unrestricted
            ? dayMatches
            : dayMatches || weekdayMatches;
    if (
      minute.values.has(local.minute) &&
      hour.values.has(local.hour) &&
      month.values.has(local.month) &&
      calendarMatches
    )
      return new Date(candidate);
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error(
    `Cron expression '${expression}' has no occurrence in the next five years`,
  );
}
