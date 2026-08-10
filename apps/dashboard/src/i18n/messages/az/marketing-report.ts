/**
 * The cross-channel report: generation, stored snapshots, section panels,
 * charts, and coverage gaps. Conventions in shell.ts.
 */
import type { MessagesFor } from "../types";

export const marketingReport: MessagesFor<"marketingReport"> = {
  stateLabel: {
    available: "tam",
    partial: "qismən əhatə",
    unavailable: "ölçülməyib",
    failed: "oxuna bilmədi",
  },
  breakdownTitle: {
    paid: "Hesab və platforma üzrə xərc",
    social: "Platforma üzrə dərc edilmiş postlar",
    competitors: "Rəqib üzrə ictimai siqnallar",
  },
  changeVsPrevious: "əvvəlki dövrə nisbətən {change}%",
  notMeasuredPeriod: "Bu dövrdə ölçülməyib.",
  compareHeading: "Bu dövr əvvəlki dövrlə müqayisədə",
  fellToZero:
    "Əvvəlki dövrə nisbətən sıfıra düşdü; cütlük saxlanılan rəqəmlərdən çəkilə bilmir.",
  notDrawn: "Çəkilməyib — {label}: {reason}",
  breakdownHeading: "Bölgü",
  notMeasuredCell: "ölçülməyib",
  sourcesPrefix: "Mənbələr:",
  sourceEntry: "{label} ({state}{reason})",
  noNarrative:
    "Hələ şərh yoxdur. Birini yazın və ya qoşulmuş agentdən istəyin — rəqəmlərdən yığılan xülasə hesab əməliyyatı olduğu halda təhlil kimi oxunur, ona görə də bu, bilərəkdən avtomatik yaradılmır.",
  openClientVersion: "Müştəri versiyasını aç",
  plainText: "Sadə mətn",
  downloadPdf: "PDF endir",
  gapsHeading: "Bu hesabatın görə bilmədikləri",
  gapsBody:
    "Hər bölmədə olduğu kimi burada da toplanıb ki, rəqəmləri ötəri oxuyan da boşluqlarla qarşılaşsın.",
  generateHeading: "Hesabat yaradın",
  periodStart: "Dövrün başlanğıcı",
  periodEnd: "Dövrün sonu",
  gathering: "Toplanılır…",
  generate: "Yarat",
  description:
    "Ödənişli, orqanik axtarış, sosial dərcetmə, e-poçt, rəqabət mühiti və tamamlanmış işləri əhatə edir — ölçülənlər üçün qrafiklər və endirilə bilən PDF ilə. Son tam 30 gün üçün tarixləri boş buraxın — cari gün istisna edilir, çünki provayderlər onu sonradan düzəldir.",
  generateFailed: "Hesabat yaradıla bilmədi.",
  generatedOn: "· {date} tarixində yaradılıb",
  empty:
    "Hələ hesabat yoxdur. Saxlanılan hesabat dondurulmuş anlıq görüntüdür — rəqəmlər hər platformanın həmin gün bildirdiyi kimidir və sonradan düzəldilmir.",
};
