import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { getLanguage } from "@/lib/i18n/language";
import {
  DecideReportDocument,
  ConnectReportDocument,
  LearnReportDocument,
  ControlTowerReportDocument,
} from "@/lib/pdf/documents";
import { CeoReportDocument, DetailedReportDocument } from "@/lib/pdf/project-reports";
import { fetchProjectImpact } from "@/lib/project-impact";

// Formats data the client already legitimately fetched and is displaying
// (its own diagnostic/scenarios, matching results, training, or control
// tower projects) into a downloadable PDF — no new Supabase reads here, so
// the only access check that matters is "is this a signed-in user at all".
const requestSchema = z.object({
  kind: z.enum(["decide", "connect", "learn", "control-tower", "project-ceo", "project-detailed"]),
  payload: z.record(z.string(), z.unknown()),
});

type Kind = z.infer<typeof requestSchema>["kind"];

// Payload shape is enforced by each React-PDF component's own prop types
// at the call site below via this one cast — the client only ever sends
// back an object it already received from one of our own API routes, so
// this is a formatting boundary, not a security one.
type PayloadKind = Exclude<Kind, "project-ceo" | "project-detailed">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BUILDERS: Record<PayloadKind, (payload: any) => ReactElement<DocumentProps>> = {
  decide: (p) => DecideReportDocument(p),
  connect: (p) => ConnectReportDocument(p),
  learn: (p) => LearnReportDocument(p),
  "control-tower": (p) => ControlTowerReportDocument(p),
};

const FILENAMES: Record<Kind, string> = {
  decide: "4tomorrow-decide.pdf",
  connect: "4tomorrow-connect.pdf",
  learn: "4tomorrow-learn.pdf",
  "control-tower": "4tomorrow-tour-de-controle.pdf",
  "project-ceo": "4tomorrow-synthese-ceo.pdf",
  "project-detailed": "4tomorrow-rapport-detaille.pdf",
};

// The two project reports are built server-side from the project id: the
// data is re-read through the signed-in user's own Supabase client, so RLS
// guarantees nobody can render someone else's project.
const projectPayloadSchema = z.object({ transformationId: z.string().uuid() });

export async function POST(request: Request) {
  const language = await getLanguage();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: language === "en" ? "Log in to export a report." : "Connecte-toi pour exporter un rapport." },
      { status: 401 }
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch {
    return NextResponse.json({ error: language === "en" ? "Invalid request." : "Requête invalide." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    let document: ReactElement<DocumentProps>;
    if (body.kind === "project-ceo" || body.kind === "project-detailed") {
      const { transformationId } = projectPayloadSchema.parse(body.payload);
      const project = await fetchProjectImpact(supabase, transformationId);
      if (!project) {
        return NextResponse.json(
          { error: language === "en" ? "Project not found." : "Projet introuvable." },
          { status: 404 }
        );
      }
      document =
        body.kind === "project-ceo"
          ? CeoReportDocument({ project, language })
          : DetailedReportDocument({ project, language });
    } else {
      document = BUILDERS[body.kind](body.payload);
    }
    buffer = await renderToBuffer(document);
  } catch {
    return NextResponse.json(
      {
        error:
          language === "en"
            ? "Incomplete data to generate this report."
            : "Données incomplètes pour générer ce rapport.",
      },
      { status: 400 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${FILENAMES[body.kind]}"`,
    },
  });
}
