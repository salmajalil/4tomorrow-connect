import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";

// Same palette as the live platform (src/app/globals.css root tokens) —
// beige/stone ground, brass gold accent, near-black ink — so a downloaded
// report reads as the same brand, not a generic "consulting report" grey.
export const PDF_COLORS = {
  pageBg: "#eee5d3",
  gold: "#a97731",
  ink: "#221c14",
  muted: "#6b5f49",
  border: "#cdbb95",
  surface: "#f8f3e8",
  success: "#3f8c5c",
  danger: "#b3402c",
};

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    color: PDF_COLORS.ink,
    backgroundColor: PDF_COLORS.pageBg,
  },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PDF_COLORS.gold, letterSpacing: 0.5 },
  moduleTag: { fontSize: 8, color: PDF_COLORS.muted, marginTop: 2 },
  generatedAt: { fontSize: 7.5, color: PDF_COLORS.muted, textAlign: "right" },
  title: { fontSize: 19, marginTop: 12, marginBottom: 3, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9.5, color: PDF_COLORS.muted, marginBottom: 4 },
  hr: { borderBottomWidth: 1, borderBottomColor: PDF_COLORS.border, marginTop: 10, marginBottom: 14 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.ink,
    marginTop: 16,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  p: { fontSize: 9.5, lineHeight: 1.5, color: PDF_COLORS.ink, marginBottom: 3 },
  muted: { fontSize: 8.5, color: PDF_COLORS.muted },
  card: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
    backgroundColor: PDF_COLORS.surface,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  badge: {
    fontSize: 7.5,
    color: PDF_COLORS.gold,
    borderWidth: 1,
    borderColor: PDF_COLORS.gold,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 5,
    marginBottom: 4,
  },
  numberedRow: { flexDirection: "row", marginBottom: 4 },
  numberBubble: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PDF_COLORS.gold,
    color: "#ffffff",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginRight: 6,
    paddingTop: 3,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: PDF_COLORS.muted,
  },
});

export function ReportShell({
  moduleTag,
  title,
  subtitle,
  children,
}: {
  moduleTag: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const generatedAt = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page} wrap>
        <View style={pdfStyles.brandRow} fixed>
          <View>
            <Text style={pdfStyles.brand}>4 TOMORROW</Text>
            <Text style={pdfStyles.moduleTag}>{moduleTag}</Text>
          </View>
          <Text style={pdfStyles.generatedAt}>Généré le {generatedAt}</Text>
        </View>

        <Text style={pdfStyles.title}>{title}</Text>
        {subtitle && <Text style={pdfStyles.subtitle}>{subtitle}</Text>}
        <View style={pdfStyles.hr} />

        {children}

        <View style={pdfStyles.footer} fixed>
          <Text>4 Tomorrow — From Complexity to Action.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={pdfStyles.h2}>{children}</Text>;
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={pdfStyles.p}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={pdfStyles.card}>{children}</View>;
}

export function NumberedItem({ index, children }: { index: number; children: ReactNode }) {
  return (
    <View style={pdfStyles.numberedRow}>
      <Text style={pdfStyles.numberBubble}>{index + 1}</Text>
      <Text style={{ ...pdfStyles.p, flex: 1 }}>{children}</Text>
    </View>
  );
}

export function BadgeList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={pdfStyles.badgeRow}>
      {items.map((item, i) => (
        <Text key={i} style={pdfStyles.badge}>
          {item}
        </Text>
      ))}
    </View>
  );
}
