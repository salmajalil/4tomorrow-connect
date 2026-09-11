import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MATCHING_MODEL } from "@/lib/anthropic";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseModelOutput,
  MatchingParseError,
  type MatchingInput,
} from "@/lib/matching";
import type { EcosystemMember } from "@/types/database";

// Headroom above MATCHING_TIMEOUT_MS (src/lib/anthropic.ts) so our own
// timeout error fires before Vercel kills the function outright.
export const maxDuration = 90;

const requestSchema = z.object({
  industry: z.string().trim().min(1, "Choisis ou saisis une industrie."),
  partnerTypes: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connecte-toi pour lancer un matching." },
      { status: 401 }
    );
  }

  let body: MatchingInput;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Requête invalide.";
    return NextResponse.json({ error: message ?? "Requête invalide." }, { status: 400 });
  }

  // Stage 1/3 of the living-directory mechanism: read the full current
  // shared directory right before generating. See the doc comment on
  // buildSystemPrompt() in src/lib/matching.ts for the full explanation —
  // this is the "re-injection" step, run fresh on every single request.
  const { data: registry, error: registryError } = await supabase
    .from("ecosystem_members")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (registryError) {
    return NextResponse.json(
      { error: "Impossible de lire le répertoire de l'écosystème. Réessaie." },
      { status: 500 }
    );
  }

  const anthropic = getAnthropicClient();
  const system = buildSystemPrompt((registry ?? []) as EcosystemMember[]);
  const userPrompt = buildUserPrompt(body);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MATCHING_MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          type: "web_search_20260318",
          name: "web_search",
          // Kept modest: each round trip adds real latency, and the whole
          // call has to land inside MATCHING_TIMEOUT_MS (see src/lib/anthropic.ts).
          max_uses: 3,
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 || err.status === 403 ? 502 : (err.status ?? 502);
      return NextResponse.json(
        { error: "Le moteur de matching n'a pas pu répondre. Réessaie dans un instant." },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Le moteur de matching a mis trop de temps à répondre. Réessaie — une description plus courte peut aussi aider." },
      { status: 504 }
    );
  }

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let result;
  try {
    result = parseModelOutput(rawText);
  } catch (err) {
    if (err instanceof MatchingParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  // Persist for this user. One organization per user today (created lazily,
  // industry kept in sync with the latest run) — a multi-org workspace model
  // is out of scope for this first version.
  let transformationId: string | null = null;
  try {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    let organizationId = existingOrg?.id;
    if (!organizationId) {
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({ owner_id: user.id, name: body.industry, industry: body.industry })
        .select("id")
        .single();
      if (orgError) throw orgError;
      organizationId = newOrg.id;
    } else {
      await supabase
        .from("organizations")
        .update({ industry: body.industry })
        .eq("id", organizationId);
    }

    const { data: transformation, error: transformationError } = await supabase
      .from("transformations")
      .insert({
        organization_id: organizationId,
        challenges: body.description || null,
        constraints:
          body.partnerTypes.length > 0
            ? `Partenaires recherchés : ${body.partnerTypes.join(", ")}`
            : null,
        status: "active",
      })
      .select("id")
      .single();
    if (transformationError) throw transformationError;
    const txId: string = transformation.id;
    transformationId = txId;

    if (result.gaps.length > 0) {
      await supabase.from("gaps").insert(
        result.gaps.map((g) => ({
          transformation_id: txId,
          name: g.name,
          reason: g.reason,
        }))
      );
    }

    if (result.matches.length > 0) {
      // Guard against a hallucinated ecosystemMemberId that isn't actually
      // in the directory we injected — the FK would otherwise reject the
      // whole insert batch.
      const knownRegistryIds = new Set((registry ?? []).map((m) => m.id));
      await supabase.from("matches").insert(
        result.matches.map((m) => ({
          transformation_id: txId,
          category: m.category,
          name: m.name,
          reason: m.reason,
          gap_addressed: m.gapAddressed,
          website: m.website ?? null,
          contact_email: m.contactEmail ?? null,
          ecosystem_member_id:
            m.source === "registry" && m.ecosystemMemberId && knownRegistryIds.has(m.ecosystemMemberId)
              ? m.ecosystemMemberId
              : null,
          source: m.source,
        }))
      );
    }
  } catch {
    // Persistence is a best-effort side effect — the user still gets their
    // results even if saving history fails. Not surfaced as a hard error.
  }

  return NextResponse.json({ transformationId, ...result });
}
