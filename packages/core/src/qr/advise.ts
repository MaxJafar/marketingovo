// Whether the code will actually scan where it is going.
//
// This is the check nobody runs, and the one that costs the most when it
// fails. A QR code is verified on the screen it was designed on — large,
// backlit, six inches from a camera — and then committed to a print run at a
// fifth of that size. The failure is not subtle when it happens; it is just
// discovered after the invoice.
//
// Two independent things decide it. The modules have to be physically big
// enough for the camera to resolve, and the two colours have to differ enough
// for it to tell them apart. Brand guidelines routinely break the second one.

import type {
  CampaignLinkFinding,
  QrErrorCorrection,
  QrPlacement,
  QrPrintAdvice,
  QrScanVerdict,
} from "../campaign/types.js";
import type { QrMatrix } from "./encode.js";

/**
 * The smallest module a current phone camera reads reliably, in millimetres.
 *
 * Below this the camera cannot separate adjacent modules, and error
 * correction does not help: it recovers damaged modules, not unresolvable
 * ones.
 */
const MINIMUM_MODULE_MM = 0.4;

/** Above this there is margin for a poor camera, a bad angle or dim light. */
const COMFORTABLE_MODULE_MM = 0.6;

/**
 * The rule of thumb every scanner vendor publishes: a code can be read from
 * about ten times its own width.
 */
const SCAN_DISTANCE_RATIO = 10;

interface PlacementProfile {
  label: string;
  recommended: QrErrorCorrection;
  reason: string;
  /** Extra module size demanded by the conditions, beyond the general floor. */
  moduleFloorMm: number;
}

const PLACEMENTS: Readonly<Record<QrPlacement, PlacementProfile>> = {
  screen: {
    label: "a screen",
    recommended: "L",
    reason:
      "A screen cannot damage the code, so the lowest level keeps it sparse and quick to read.",
    moduleFloorMm: MINIMUM_MODULE_MM,
  },
  "print-handheld": {
    label: "something held in the hand",
    recommended: "M",
    reason:
      "Paper picks up creases and thumb marks, which the middle level absorbs without adding much density.",
    moduleFloorMm: 0.5,
  },
  "print-poster": {
    label: "a poster",
    recommended: "M",
    reason:
      "A poster is read at distance rather than damaged, so size matters more than recovery here.",
    moduleFloorMm: 0.6,
  },
  packaging: {
    label: "packaging",
    recommended: "Q",
    reason:
      "Packaging is curved, scuffed in transit and often printed on an absorbent surface, so a quarter of the code should be recoverable.",
    moduleFloorMm: 0.6,
  },
  outdoor: {
    label: "outdoors",
    recommended: "H",
    reason:
      "Outdoor codes get rain, sun and partial obstruction, and nobody reprints them quickly.",
    moduleFloorMm: 0.8,
  },
};

/** WCAG relative luminance, which tracks what a camera sensor sees closely. */
function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const value = match[1]!;
  const channels = [0, 2, 4].map((offset) => {
    const component =
      Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return component <= 0.03928
      ? component / 12.92
      : ((component + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function colorContrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface AdviseQrInput {
  matrix: QrMatrix;
  placement: QrPlacement;
  /** The width the code will occupy on the finished thing, quiet zone included. */
  printedWidthMm: number;
  quietZone: number;
  darkColor: string;
  lightColor: string;
}

/**
 * The recommended level for a placement, so the caller can offer it rather
 * than making the operator guess between four letters.
 */
export function recommendedErrorCorrection(placement: QrPlacement): {
  level: QrErrorCorrection;
  reason: string;
} {
  const profile = PLACEMENTS[placement];
  return { level: profile.recommended, reason: profile.reason };
}

export function adviseQr(input: AdviseQrInput): QrPrintAdvice {
  const profile = PLACEMENTS[input.placement];
  const modulesPerSide = input.matrix.size + input.quietZone * 2;
  const moduleSizeMm = input.printedWidthMm / modulesPerSide;
  const floor = Math.max(MINIMUM_MODULE_MM, profile.moduleFloorMm);
  const comfortable = Math.max(COMFORTABLE_MODULE_MM, profile.moduleFloorMm);

  const verdict: QrScanVerdict =
    moduleSizeMm < floor
      ? "unscannable"
      : moduleSizeMm < comfortable
        ? "tight"
        : "comfortable";

  const contrast = colorContrastRatio(input.darkColor, input.lightColor);
  const findings: CampaignLinkFinding[] = [];

  if (verdict === "unscannable") {
    findings.push({
      rule: "qr-too-small",
      severity: "blocking",
      field: "printedWidthMm",
      message: `At ${input.printedWidthMm}mm wide this code puts ${modulesPerSide} modules across, giving each one ${moduleSizeMm.toFixed(2)}mm. A phone camera cannot resolve modules below about ${floor}mm on ${profile.label}, and error correction does not help — it recovers damaged modules, not ones the camera never separated.`,
      remedy: `Print it at least ${Math.ceil(comfortable * modulesPerSide)}mm wide, or shorten the URL so the code needs fewer modules.`,
    });
  } else if (verdict === "tight") {
    findings.push({
      rule: "qr-marginal-size",
      severity: "warning",
      field: "printedWidthMm",
      message: `Each module lands at ${moduleSizeMm.toFixed(2)}mm, which reads on a good camera in good light and starts failing on older phones or at an angle.`,
      remedy: `${Math.ceil(comfortable * modulesPerSide)}mm wide would leave margin.`,
    });
  }

  if (contrast < 3) {
    findings.push({
      rule: "qr-low-contrast",
      severity: "blocking",
      field: "style",
      message: `The two colours differ by a contrast ratio of ${contrast.toFixed(1)}:1. Scanners threshold the image into light and dark before decoding, and below about 3:1 that step fails regardless of how large the code is printed.`,
      remedy:
        "Keep the dark modules dark. Brand colour works for the modules only when it is genuinely darker than the background.",
    });
  } else if (contrast < 7) {
    findings.push({
      rule: "qr-moderate-contrast",
      severity: "warning",
      field: "style",
      message: `A contrast ratio of ${contrast.toFixed(1)}:1 decodes in good light but leaves little margin under shop lighting or on a screen at low brightness.`,
      remedy: "Darker modules, or a lighter background, would be safer.",
    });
  }

  if (
    relativeLuminance(input.darkColor) > relativeLuminance(input.lightColor)
  ) {
    findings.push({
      rule: "qr-inverted",
      severity: "blocking",
      field: "style",
      message:
        "The modules are lighter than the background, which inverts the code. Many scanners handle inversion and a meaningful number still do not, and there is no way to tell which ones your audience has.",
      remedy: "Swap the two colours.",
    });
  }

  if (input.quietZone < 4) {
    findings.push({
      rule: "qr-quiet-zone",
      severity: input.quietZone === 0 ? "blocking" : "warning",
      field: "style",
      message: `The quiet zone is ${input.quietZone} modules. The standard requires four, and it is what lets a camera find the code's edge against a busy page — not decoration that can be trimmed for layout.`,
      remedy: "Set the quiet zone to at least 4.",
    });
  }

  if (input.matrix.errorCorrection !== profile.recommended) {
    const order: QrErrorCorrection[] = ["L", "M", "Q", "H"];
    const lower =
      order.indexOf(input.matrix.errorCorrection) <
      order.indexOf(profile.recommended);
    findings.push({
      rule: "qr-error-correction-mismatch",
      severity: lower ? "warning" : "advice",
      field: "style",
      message: lower
        ? `Level ${input.matrix.errorCorrection} recovers less than level ${profile.recommended}, which is what ${profile.label} normally needs. ${profile.reason}`
        : `Level ${input.matrix.errorCorrection} is more than ${profile.label} needs, and the extra recovery costs modules — which makes the code denser and so harder to scan small.`,
      remedy: `Level ${profile.recommended} suits this placement.`,
    });
  }

  const order = { blocking: 0, warning: 1, advice: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    version: input.matrix.version,
    moduleCount: input.matrix.size,
    errorCorrection: input.matrix.errorCorrection,
    printedWidthMm: input.printedWidthMm,
    moduleSizeMm: Math.round(moduleSizeMm * 1000) / 1000,
    verdict,
    recommendedWidthMm: Math.ceil(comfortable * modulesPerSide),
    maxScanDistanceMm: Math.round(input.printedWidthMm * SCAN_DISTANCE_RATIO),
    contrastRatio: Math.round(contrast * 100) / 100,
    findings,
  };
}
