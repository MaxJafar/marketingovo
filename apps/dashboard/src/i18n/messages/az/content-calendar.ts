/** The content calendar: entries, approvals, publish records, and media. */
import type { MessagesFor } from "../types";

export const contentCalendar: MessagesFor<"contentCalendar"> = {
  entry: {
    noTimeSet: "vaxt təyin edilməyib",
    attachmentSingular: "{count} qoşma",
    attachmentPlural: "{count} qoşma",
    sent: "{time} göndərilib",
    openPost: "postu aç",
    indeterminate:
      "Sorğu göndərildi və cavab qeydə alınmadı, ona görə bu postun çıxıb-çıxmadığı naməlumdur. Yenidən cəhd etməzdən əvvəl {platform} yoxlayın — Marketingovo özbaşına təkrar göndərməyəcək.",
    refusedFallback: "Provayder bu postu rədd etdi.",
    needsTimeTitle: "Təsdiqləməzdən əvvəl posta vaxt verin.",
    approve: "Bu vaxt üçün təsdiqlə",
    sending: "Göndərilir…",
    sendNow: "İndi göndər",
  },
  media: {
    title: "Media",
    uploadLabel: "Media yüklə",
    sizeKb: "{size}KB",
    publiclyReachable:
      "İctimai əlçatandır ({source}). Instagram bunu yükləyə bilər.",
    storedLocally:
      "Yalnız bu cihazda saxlanılır. Telegram, X və Facebook onu birbaşa dərc edir; Instagram edə bilmir, çünki o, yükləməni qəbul etmək əvəzinə medianı ictimai URL-dən götürür.",
    relayTitle:
      "Bu faylı konfiqurasiya etdiyiniz obyekt yaddaşına yükləyir ki, Instagram onu götürə bilsin.",
    uploading: "Yüklənir…",
    relay: "Yaddaşıma dərc et",
    urlPlaceholder: "və ya öz host etdiyiniz ictimai https:// URL yerləşdirin",
    useUrl: "Bu URL-i işlət",
    uploadRefused: "Yükləmə rədd edildi.",
    empty:
      "Hələ media yoxdur. Yüklədiyiniz fayllar bu cihazda qalır və post çıxanda birbaşa Telegram, X və Facebook-a göndərilir.",
  },
  overdue: {
    title: "Vaxtı keçmiş və göndərilməmiş",
    body: "Bunlar artıq keçmiş bir an üçün planlaşdırılmışdı və heç vaxt təsdiqlənmədi, ona görə heç nə göndərilmədi. Yalnız xanaları çəkən təqvim onları gizlədərdi.",
  },
  week: {
    title: "Növbəti iki həftə",
    loading: "Təqvim oxunur…",
    emptyBefore: "Heç nə planlaşdırılmayıb. Postu",
    composerLink: "redaktorda",
    emptyAfter:
      "hazırlayın və ya qoşulmuş agentdən yazmasını istəyin, sonra ona burada vaxt verin.",
  },
  unscheduled: {
    title: "Hazırlanıb, vaxt gözləyir",
    body: "Vaxt seçin və təsdiqləyin. Artıq təsdiqlənmiş postun vaxtını dəyişmək təsdiqi ləğv edir, çünki vaxt təsdiqlədiyinizin bir hissəsidir.",
    timeLabel: "Planlaşdırılmış vaxt",
    schedule: "Seçilmiş postu planlaşdır",
    scheduleFailed: "Post planlaşdırıla bilmədi.",
  },
};
