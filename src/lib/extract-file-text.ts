import { parseJsonResponse } from "@/lib/parse-json-response";

// Shared by Decide's and Learn's intake forms — reuses the same generic
// .docx extraction endpoint (extraction logic isn't module-specific).
export async function extractFileText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return file.text();
  }
  if (lower.endsWith(".docx")) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/decide/extract-doc", { method: "POST", body: formData });
    const { data } = await parseJsonResponse(res);
    if (!res.ok) throw new Error((data.error as string) || "Extraction impossible.");
    return data.text as string;
  }
  throw new Error("Format non supporté — utilise .txt, .md ou .docx (le PDF n'est pas pris en charge).");
}
