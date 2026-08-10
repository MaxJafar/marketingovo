/** Social research: honest source status and where measured data lives. */
import type { MessagesFor } from "../types";

export const socialResearch: MessagesFor<"socialResearch"> = {
  status: {
    title: "Mənbə statusu",
    connectedSingular:
      "Paylaşım üçün {count} sosial mənbə qoşulub. Dinləmənin — bəhslər, sentiment, cəlbetmə — hələ kollektoru yoxdur, ona görə də bu qəbildən heç nə ölçülmür və göstərilmir.",
    connectedPlural:
      "Paylaşım üçün {count} sosial mənbə qoşulub. Dinləmənin — bəhslər, sentiment, cəlbetmə — hələ kollektoru yoxdur, ona görə də bu qəbildən heç nə ölçülmür və göstərilmir.",
    none: "Heç bir sosial mənbə qoşulmayıb və sosial dinləmənin hələ kollektoru yoxdur — buna görə bu səhifə rəqəmləri uydurmaq əvəzinə heç bir bəhs və ya sentiment göstəricisi göstərmir.",
    connectLink: "mənbə qoşun",
  },
  measured: {
    title: "Bu gün nə ölçülür",
    body: "Paylaşım başdan-sona ölçülür: təqvimdə hazırlanan hər post hər platformaya göndərilən dəqiq sorğunun dəyişməz qeydini saxlayır və çarpaz kanal hesabatı platforma üzrə dərc edilmiş, rədd edilmiş və qeyri-müəyyən göndərişləri sayır.",
    openCalendar: "Təqvimi aç →",
    openReport: "Hesabatda bax →",
  },
  agent: {
    title: "Agentdən soruşun",
    bodyBefore:
      "Sosial dinləmə hələ Marketingovo kollektoru deyil. Qoşulmuş agent bunu yenə də öz alətlərindən sizin üçün araşdıra bilər — aşağıdakı terminalda soruşmağa çalışın, məsələn",
    examplePrompt: "bu ay Reddit-də haqqımızda deyilənləri xülasə et",
    bodyAfter: ".",
  },
};
