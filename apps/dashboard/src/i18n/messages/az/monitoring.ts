/** Monitoring page: the schedule editor, schedule list, and alert stream. */
import type { MessagesFor } from "../types";

export const monitoring: MessagesFor<"monitoring"> = {
  eyebrow: "Daimi əminlik",
  title: "İzləmə",
  description:
    "Lokal auditləri qrafikə salın və geriləmələri hesabat sürprizinə çevrilmədən üzə çıxarın. Qrafiklər Marketingovo arxa fon xidməti aktiv olduğu müddətdə işləyir.",
  mutationErrorTitle: "Qrafik dəyişikliyi alınmadı",
  editor: {
    editTitle: "Qrafiki redaktə et",
    createTitle: "Qrafik yaradın",
    intro:
      "Sayt auditini işlədin və ya çarpaz kanal hesabatını marketoloqa uyğun ritmlə yaradın, ya da standart beş sahəli cron ifadəsindən istifadə edin.",
    cancelEdit: "Redaktəni ləğv et",
    workflowLabel: "Nə işlədilsin",
    workflowAudit: "Sayt auditi",
    workflowReport: "Çarpaz kanal hesabatı",
    workflowAsCreated: "{workflow} (yaradıldığı kimi)",
    frequencyLabel: "Tezlik",
    frequencyDaily: "Gündəlik",
    frequencyWeekly: "Həftəlik",
    frequencyMonthly: "Aylıq (ayın 1-i)",
    frequencyCustom: "Xüsusi cron",
    cronLabel: "Cron ifadəsi",
    timeLabel: "Lokal vaxt",
    dayLabel: "Gün",
    timezoneLabel: "Saat qurşağı",
    reportNoticeTitle: "Hesabatlar auditlərə istinad edir",
    reportNoticeBody:
      "Hesabat yalnız öz dövründə işləmiş auditə istinad edir. Hesabat qrafikini audit qrafiki ilə cütləşdirin, əks halda onun orqanik bölməsi ölçülmədiyini bildirəcək.",
    saving: "Yadda saxlanılır…",
    save: "Qrafiki yadda saxla",
    create: "Qrafik yarat",
  },
  weekdays: {
    monday: "Bazar ertəsi",
    tuesday: "Çərşənbə axşamı",
    wednesday: "Çərşənbə",
    thursday: "Cümə axşamı",
    friday: "Cümə",
    saturday: "Şənbə",
    sunday: "Bazar",
  },
  cadenceMonthly: "Hər ayın 1-i saat {time}",
  cadenceDaily: "Hər gün saat {time}",
  cadenceWeekly: "Hər {weekday} saat {time}",
  cadenceDayFallback: "{day}-cı gün",
  schedules: {
    title: "Qrafiklər",
    description: "Bu layihə üçün davamlı audit qrafikləri.",
    pauseAria: "{name} qrafikini dayandır",
    enableAria: "{name} qrafikini aktivləşdir",
    timezoneUnavailable: "Saat qurşağı əlçatan deyil",
    nextRun: "Növbəti: {date}",
    edit: "Redaktə et",
    delete: "Sil",
    deleteConfirm: "{name} qrafiki silinsin?",
    emptyTitle: "Qrafik yoxdur",
    emptyDescription:
      "Arxa fon xidməti aktiv olarkən təkrar auditlər işlətmək üçün yuxarıda qrafik yaradın.",
  },
  alerts: {
    title: "Son xəbərdarlıqlar",
    description: "Baxış tələb edən açıq və qəbul edilmiş dəyişikliklər.",
    noDetail: "Əlavə təfərrüat qaytarılmadı.",
    status: "Status: {status}",
    emptyTitle: "İzləmə xəbərdarlığı yoxdur",
    emptyDescription:
      "Etibarlı boş xəbərdarlıq axını xəbərdarlıq qaytarılmadığı deməkdir — hər mənbənin sağlam olduğu demək deyil.",
  },
};
