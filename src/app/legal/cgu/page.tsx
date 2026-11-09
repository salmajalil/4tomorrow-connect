import { getLanguage } from "@/lib/i18n/language";
import { getLegalContent } from "@/lib/legal-content";
import { LegalPageView } from "@/components/legal/legal-page-view";

export default async function CguPage() {
  const language = await getLanguage();
  const content = getLegalContent(language);
  return <LegalPageView page={content.cgu} />;
}
