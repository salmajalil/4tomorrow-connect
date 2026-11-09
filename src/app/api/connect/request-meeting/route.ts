import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FREE_TEXT_LENGTH } from "@/lib/input-limits";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  matchId: z.string().uuid().nullable().optional(),
  partnerName: z.string().trim().min(1),
  requesterName: z.string().trim().min(1),
  requesterEmail: z.string().trim().email(),
  message: z.string().trim().max(MAX_FREE_TEXT_LENGTH).default(""),
});

// No email is actually sent here — same finding as
// src/app/api/control-tower/invite-member/route.ts: no mailer exists
// anywhere in this codebase. This only records the request server-side;
// the client shows an honest "pas d'envoi automatique" state instead of
// pretending a mail went out (see `delivered: false` below).
export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: language === "en" ? "Log in first." : "Connecte-toi d'abord." }, { status: 401 });
  }

  let body;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meeting_requests")
    .insert({
      transformation_id: body.transformationId,
      match_id: body.matchId ?? null,
      partner_name: body.partnerName,
      requester_name: body.requesterName,
      requester_email: body.requesterEmail,
      message: body.message,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[connect/request-meeting] insert failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: language === "en" ? "Couldn't save the request. Try again." : "Impossible d'enregistrer la demande. Réessaie." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id, delivered: false });
}
