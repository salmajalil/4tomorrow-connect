import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";

// .docx only — mammoth extracts reliably from it. We deliberately don't
// claim PDF support: PDF text extraction is unreliable without a much
// heavier pipeline (layout/OCR), and a silent bad extraction is worse than
// no extraction. .txt/.md are read directly client-side, no server call needed.
export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to import a document." : "Connecte-toi pour importer un document." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: language === "en" ? "No file received." : "Aucun fichier reçu." },
      { status: 400 }
    );
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json(
      { error: language === "en" ? "Only .docx files are supported here." : "Seuls les fichiers .docx sont supportés ici." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: text } = await mammoth.extractRawText({ buffer });
    return NextResponse.json({ text: text.trim() });
  } catch {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Couldn't extract text from this document. Try again or paste the content directly."
            : "Impossible d'extraire le texte de ce document. Réessaie ou colle le contenu directement.",
      },
      { status: 500 }
    );
  }
}
