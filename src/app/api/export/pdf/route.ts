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
import { loadConnectExport, loadDecideExport, loadLearnExport } from "@/lib/pdf/export-data";

// "decide", "connect", "learn", "project-ceo" and "project-detailed" never
// render client-supplied content: the client sends an id, the data is
// re-read server-side through the user's own Supabase client (RLS), and any
// other field in the payload is ignored. Rendering a posted object would let
// anyone produce a 4 Tomorrow-branded PDF with arbitrary content.
//
// "control-tower" still formats the client payload (out of scope of this
// fix — see buildControlTower below).
const requestSchema = z.object({
  kind: z.enum(["decide", "connect", "learn", "control-tower", "project-ceo", "project-detailed"]),
  payload: z.record(z.string(), z.unknown()),
});

type Kind = z.infer<typeof requestSchema>["kind"];

// Only remaining client-payload kind. Its shape is enforced by the
// React-PDF component's own prop types via this one cast.
// TODO(security): re-read control tower projects server-side too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildControlTower = (payload: any): ReactElement<DocumentProps> => ControlTowerReportDocument(payload);

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
const learnPayloadSchema = z.object({ trainingId: z.string().uuid() });

class ExportNotFoundError extends Error {}

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
    } else if (body.kind === "decide") {
      const { transformationId } = projectPayloadSchema.parse(body.payload);
      const data = await loadDecideExport(supabase, transformationId);
      if (!data) throw new ExportNotFoundError();
      document = DecideReportDocument(data);
    } else if (body.kind === "connect") {
      const { transformationId } = projectPayloadSchema.parse(body.payload);
      const data = await loadConnectExport(
        supabase,
        transformationId,
        language === "en" ? "Your project" : "Ton projet"
      );
      if (!data) throw new ExportNotFoundError();
      document = ConnectReportDocument(data);
    } else if (body.kind === "learn") {
      const { trainingId } = learnPayloadSchema.parse(body.payload);
      const data = await loadLearnExport(supabase, trainingId);
      if (!data) throw new ExportNotFoundError();
      document = LearnReportDocument(data);
    } else {
      document = buildControlTower(body.payload);
    }
    buffer = await renderToBuffer(document);
  } catch (err) {
    if (err instanceof ExportNotFoundError) {
      return NextResponse.json(
        { error: language === "en" ? "Nothing to export for this project." : "Rien à exporter pour ce projet." },
        { status: 404 }
      );
    }
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
