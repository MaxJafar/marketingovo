/** Integrations page: connector cards and their credential sub-forms. */
import type { MessagesFor } from "../types";

export const integrations: MessagesFor<"integrations"> = {
  eyebrow: "Qoşulmuş məlumatlar",
  title: "İnteqrasiyalar",
  description:
    "Axtarış, analitika, tarama və kontent siqnallarını vahid, əsaslandırıla bilən qərar qatına gətirin.",
  vaultNoticeTitle: "Etimadnamələr brauzerdən kənarda qalır",
  vaultNoticeBody:
    "Gizli dəyərlər şifrələnmiş server tərəfi saxlama üçün lokal API-yə göndərilir. UI yalnız qoşulma statusunu və təhlükəsiz hesab etiketlərini alır.",
  testFailedTitle: "Qoşulma testi alınmadı",
  testCompleteTitle: "Qoşulma testi tamamlandı",
  testCompleteBody: "İnteqrasiya statusu yeniləndi.",
  removedTitle: "Lokal etimadnamə silindi",
  removedBody:
    "Provayder Marketingovo-dan ayrıldı. Gizli olmayan sayt uyğunlaşdırması sonrakı yenidən qoşulma üçün əlçatan qalır.",
  cancel: "Ləğv et",
  credentialForm: {
    apiKeyLabel: "API açarı",
    title: "{name} qoş",
    intro:
      "Etimadnamələr birbaşa lokal API-yə göndərilir. Bu panel onları heç vaxt brauzer yaddaşında saxlamır və geri oxumur.",
    closeAria: "Etimadnamə formasını bağla",
    textHelp: "Platformanın verdiyi hesab identifikatorunu daxil edin.",
    secretHelp:
      "API etimadnamə anbarında saxlanılır; heç vaxt brauzerə qaytarılmır.",
    notSavedTitle: "Etimadnamələr yadda saxlanmadı",
    saving: "Təhlükəsiz yadda saxlanılır…",
    saveAndConnect: "Yadda saxla və qoş",
    continue: "Davam et",
  },
  configurationForm: {
    title: "{name} konfiqurasiya et",
    intro:
      "Bu gizli olmayan parametrlər sayt üzrə saxlanılır, beləliklə bir lokal iş sahəsi bir neçə saytı fərqli provayder mülklərinə uyğunlaşdıra bilər.",
    closeAria: "Konfiqurasiya formasını bağla",
    help: "Bu parametrdə heç bir gizli etimadnamə materialı yoxdur.",
    notSavedTitle: "Konfiqurasiya yadda saxlanmadı",
    saving: "Yadda saxlanılır…",
    save: "Konfiqurasiyanı yadda saxla",
  },
  removal: {
    title: "{name} üçün lokal girişi ləğv et",
    intro:
      "Bu etimadnaməni əməliyyat sistemi dəstəkli lokal anbardan silin və onu hər lokal layihədən ayırın. Gizli olmayan sayt uyğunlaşdırmaları sonrakı yenidən qoşulma üçün yerində qalır.",
    closeAria: "Etimadnamə silmə formasını bağla",
    providerNoticeTitle: "Provayder girişi aktiv qala bilər",
    providerNoticeBody:
      "Marketingovo öz lokal nüsxəsini silə bilər, lakin provayderdəki API açarını və ya OAuth icazəsini deaktiv edə bilməz. Etimadnaməni mənbəyində ləğv etmək lazım olduqda provayderin quraşdırma səhifəsindən istifadə edin.",
    acknowledgement:
      "Başa düşürəm ki, bu, {name} inteqrasiyasını hər lokal layihədə ayırır.",
    notRemovedTitle: "Etimadnamə silinmədi",
    removing: "Silinir…",
    remove: "Lokal etimadnaməni sil",
  },
  card: {
    categoryFallback: "Məlumat mənbəyi",
    descriptionFallback: "İnteqrasiya təsviri qaytarılmadı.",
    account: "Hesab",
    notConnected: "Qoşulmayıb",
    lastVerifiedSync: "Son təsdiqlənmiş sinxronizasiya",
    quotaRemaining: "Qalan kvota",
    quotaReset: "Kvota sıfırlanması",
    rotateCredentials: "Etimadnamələri rotasiya et",
    addOptionalApiKey: "İstəyə bağlı API açarı əlavə et",
    connectApiKey: "API açarını qoş",
    connectCredentials: "Etimadnamələri qoş",
    connectAccount: "Hesabı qoş",
    reconnectAccount: "Hesabı yenidən qoş",
    editSiteMapping: "Sayt uyğunlaşdırmasını redaktə et",
    configureSite: "Saytı konfiqurasiya et",
    testConnection: "Qoşulmanı yoxla",
    revokeAria: "{name} lokal girişini ləğv et",
    revoke: "Lokal girişi ləğv et",
  },
  emptyTitle: "Əlçatan inteqrasiya yoxdur",
  emptyDescription:
    "API inteqrasiya kataloqu qaytarmadı. Sistem sağlamlığını və server konfiqurasiyasını yoxlayın.",
};
