import { useEffect, useState, type ReactNode } from "react";

/**
 * Raster pixel art is generated separately (see
 * docs/design/terminal-ui-asset-packet.md) and lands in the repo after the UI
 * that uses it. So every sprite here is optional by construction: the component
 * probes the file once, draws an inline SVG stand-in until it exists, and
 * upgrades itself the moment it does.
 *
 * The probe matters more than it looks. A plain <img onError> would paint a
 * broken-image glyph for a frame before the fallback swaps in, and a bare
 * mask-image on a missing file renders as an invisible element with no hint
 * that anything is wrong. Asking the browser to load the file first and only
 * then committing to a render path avoids both.
 */

type Availability = "probing" | "present" | "absent";

const probeCache = new Map<string, Availability>();
const probeWaiters = new Map<string, Set<(value: Availability) => void>>();

function probe(src: string): Availability {
  const cached = probeCache.get(src);
  if (cached) return cached;
  probeCache.set(src, "probing");

  // jsdom has no real image loader, so tests would hang on "probing" forever.
  // Treating that environment as "no assets" renders the SVG fallbacks, which
  // is exactly what the tests should be asserting against anyway.
  if (typeof Image === "undefined") {
    probeCache.set(src, "absent");
    return "absent";
  }

  const image = new Image();
  const settle = (value: Availability) => {
    probeCache.set(src, value);
    const waiters = probeWaiters.get(src);
    probeWaiters.delete(src);
    for (const waiter of waiters ?? []) waiter(value);
  };
  image.addEventListener("load", () => settle("present"));
  image.addEventListener("error", () => settle("absent"));
  image.src = src;
  return "probing";
}

function useSprite(src: string): Availability {
  const [state, setState] = useState<Availability>(() => probe(src));

  useEffect(() => {
    const current = probe(src);
    setState(current);
    if (current !== "probing") return;
    const waiter = (value: Availability) => setState(value);
    const waiters = probeWaiters.get(src) ?? new Set();
    waiters.add(waiter);
    probeWaiters.set(src, waiters);
    return () => {
      waiters.delete(waiter);
    };
  }, [src]);

  return state;
}

/** Test seam: lets a suite assert both the fallback and the loaded path. */
export function __setSpriteAvailability(
  src: string,
  value: Availability,
): void {
  probeCache.set(src, value);
}

export interface PixelSpriteProps {
  src: string;
  /** Inline stand-in drawn until the raster asset exists. */
  fallback: ReactNode;
  size: number;
  height?: number;
  alt?: string;
  className?: string;
}

/**
 * A full-colour sprite: KPI badges, mascots, platform marks, panel charms.
 * Decorative by default — pass `alt` only when the art carries meaning the
 * surrounding text does not already state.
 */
export function PixelSprite({
  src,
  fallback,
  size,
  height,
  alt = "",
  className,
}: PixelSpriteProps) {
  const availability = useSprite(src);
  const box = { width: size, height: height ?? size };

  if (availability === "present") {
    return (
      <img
        className={`pixel-sprite ${className ?? ""}`.trim()}
        src={src}
        alt={alt}
        {...box}
        aria-hidden={alt ? undefined : true}
      />
    );
  }

  return (
    <svg
      className={`pixel-sprite ${className ?? ""}`.trim()}
      viewBox="0 0 24 24"
      {...box}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {fallback}
    </svg>
  );
}

export interface PixelMaskIconProps {
  src: string;
  fallback: ReactNode;
  className?: string;
}

/**
 * A single-colour glyph that inherits the current text colour. The delivered
 * asset is a white silhouette, applied as a CSS mask so one file covers the
 * idle, hover, and active states without a second export.
 */
export function PixelMaskIcon({
  src,
  fallback,
  className,
}: PixelMaskIconProps) {
  const availability = useSprite(src);
  const classes = `pixel-nav-icon ${className ?? ""}`.trim();

  if (availability === "present") {
    return (
      <span
        className={classes}
        aria-hidden="true"
        style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}
      />
    );
  }

  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={{ background: "none" }}
    >
      {fallback}
    </svg>
  );
}
