import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import { computeFlow, validateFlowInputs, type FlowLevers, type FlowStepInput } from "@/lib/decide-flow-calc";

// D02 — Cartographie dynamique. Appelé depuis la vue process (voir
// src/components/decide/flow-view.tsx) chaque fois que l'utilisateur
// (re)calcule après avoir saisi/importé des étapes ou ajusté un levier
// « et si ». Le calcul (délai, goulot, couverture de la demande) est fait
// ici, côté serveur, par une fonction pure — jamais par l'IA.
const stepSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  process: z.number(),
  wait: z.number(),
  capacity: z.number(),
});

const leversSchema = z.object({
  waitCut: z.record(z.string(), z.number()),
  capAdd: z.record(z.string(), z.number()),
});

const requestSchema = z.object({
  transformationId: z.string().uuid(),
  demand: z.number(),
  steps: z.array(stepSchema),
  levers: leversSchema,
});

export async function GET(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in first." : "Connecte-toi d'abord." },
      { status: 401 }
    );
  }

  const transformationId = new URL(request.url).searchParams.get("transformationId");
  if (!transformationId) {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  // RLS (owner or accepted transformation member, see
  // 0021_process_flow.sql) returns nothing otherwise — no extra ownership
  // check needed here.
  const { data } = await supabase.from("process_flows").select("*").eq("transformation_id", transformationId).maybeSingle();

  return NextResponse.json({ flow: data ?? null });
}

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in first." : "Connecte-toi d'abord." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  const steps: FlowStepInput[] = body.steps;
  const levers: FlowLevers = body.levers;

  const errors = validateFlowInputs(steps, body.demand);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const result = computeFlow(steps, body.demand, levers);

  // RLS (owner-only) rejects this write outright if the transformation isn't
  // the caller's own — no extra ownership check needed here.
  const { data, error } = await supabase
    .from("process_flows")
    .upsert(
      {
        transformation_id: body.transformationId,
        demand: body.demand,
        steps,
        levers,
        result,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "transformation_id" }
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: language === "en" ? "Could not save the process map." : "Impossible d'enregistrer la cartographie." },
      { status: 400 }
    );
  }

  return NextResponse.json({ flow: data, result });
}
