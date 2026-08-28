import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaskLane — work, labelled",
  description:
    "A work tracker for small teams. Organizations, projects, tasks, and an activity log that never forgets who moved what.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`}>
      <body>
        {/*
          THESIS: A work tracker built as a museum wayfinding program — every task is a wall
          label, every project a room, the board a floor plan. Refuses the SaaS card-grid dashboard.
          OWN-WORLD: Paper white ground, cool paper panels, near-black ink, hairline rules doing all
          dividing (no shadow-as-structure), one signal cobalt accent reserved for primary action and
          current selection, muted status marks, Archivo (expanded for signage display) with tabular
          JetBrains Mono for references and figures.
          STORY: A lead sees their own team's board rendered at full fidelity in the first viewport,
          believes the tool is precise rather than busy, and starts a workspace.
          FIRST VIEWPORT: Left, the product statement in expanded signage caps with the primary action
          inline beneath it; right, a real working board plate, labels in their slots, one column live.
          FORM: Museum wall label & wayfinding program, #7 of the grounded list, seed 906f942b.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
          verdict, DESIGN.md, and every shipping raster carrying its provenance.
        */}
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
