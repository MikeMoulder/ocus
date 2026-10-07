// Guard-approved tailored resume → one-page ATS-safe PDF (real text, Helvetica, no hyphenation).
import React from "react";
import { Document, Page, Text, View, Link, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

Font.registerHyphenationCallback((word) => [word]);

const h = React.createElement;
const ACCENT = "#0F766E";
const s = StyleSheet.create({
  page: { paddingVertical: 22, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9.1, lineHeight: 1.28, color: "#15171A" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", lineHeight: 1.15 },
  title: { fontSize: 11, color: "#3D424A", marginTop: 4, lineHeight: 1.2 },
  contact: { fontSize: 8.8, color: "#3D424A", marginTop: 6 },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", color: ACCENT, marginTop: 9, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.6, borderBottomColor: "#D6D6D0" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  muted: { color: "#5B6068", fontSize: 8.8 },
  bullet: { flexDirection: "row", marginTop: 1.5, paddingRight: 6 },
  dot: { width: 10 },
  link: { color: ACCENT, textDecoration: "none" },
});

const fmt = (d: string) => (d === "present" ? "Present" : new Date(d + "-01").toLocaleString("en-US", { month: "short", year: "numeric" }));
const bullets = (bs: any[]) => bs.map((b, i) => h(View, { key: i, style: s.bullet }, h(Text, { style: s.dot }, "•"), h(Text, { style: { flex: 1 } }, b.text)));
const byId = (arr: any[], id: string) => arr.find((x) => x.id === id);

export async function renderResumePdf(base: any, out: any): Promise<Buffer> {
  const c = base.contact || {};
  const linkedin = base.application_facts?.linkedin_url;
  const contactBits = [c.email, c.phone, c.location].filter(Boolean).join("  ·  ");
  const projects = (out.projects || []).filter((p: any) => byId(base.projects || [], p.id));
  const experience = (out.experience || []).filter((e: any) => byId(base.experience || [], e.id));

  const doc = h(Document, { title: `${base.name} – Resume`, author: base.name },
    h(Page, { size: "A4", style: s.page },
      h(Text, { style: s.name }, base.name),
      h(Text, { style: s.title }, base.title),
      h(Text, { style: s.contact }, contactBits,
        c.github ? "  ·  " : "", c.github ? h(Link, { src: c.github, style: s.link }, c.github.replace("https://", "")) : "",
        linkedin ? "  ·  " : "", linkedin ? h(Link, { src: linkedin, style: s.link }, linkedin.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")) : ""),

      h(Text, { style: s.h2 }, "SUMMARY"),
      h(Text, null, out.summary?.text || base.summary?.text),

      h(Text, { style: s.h2 }, "SKILLS"),
      h(Text, null, (out.skills || base.skills).join(" · ")),

      projects.length ? h(Text, { style: s.h2 }, "SELECTED PROJECTS") : null,
      ...projects.map((p: any) => {
        const bp = byId(base.projects, p.id);
        const link = bp.links?.live || bp.links?.repo;
        return h(View, { key: p.id, style: { marginBottom: 4 }, wrap: false },
          h(Text, null, h(Text, { style: s.itemTitle }, bp.name), h(Text, { style: s.muted }, `  ·  ${bp.tagline}`)),
          h(View, { style: s.row },
            h(Text, { style: [s.muted, { flex: 1, paddingRight: 10 }] }, [bp.context, (bp.stack || []).slice(0, 4).join(", ")].filter(Boolean).join(" · ")),
            link ? h(Link, { src: link, style: [s.link, { fontSize: 8.8 }] }, link.replace("https://", "").replace("www.", "")) : null),
          ...bullets(p.bullets));
      }),

      h(Text, { style: s.h2 }, "EXPERIENCE"),
      ...experience.map((e: any) => {
        const be = byId(base.experience, e.id);
        return h(View, { key: e.id, style: { marginBottom: 4 }, wrap: false },
          h(View, { style: s.row },
            h(Text, null, h(Text, { style: s.itemTitle }, be.role), h(Text, { style: s.muted }, `  ·  ${be.company}`)),
            h(Text, { style: s.muted }, `${fmt(be.start)} – ${fmt(be.end)}`)),
          ...bullets(e.bullets));
      }),

      h(Text, { style: s.h2 }, "EDUCATION & LANGUAGES"),
      ...(base.education || []).map((ed: any) => h(View, { key: ed.id, style: s.row },
        h(Text, null, h(Text, { style: s.itemTitle }, ed.degree), h(Text, { style: s.muted }, `  ·  ${ed.school}, ${ed.location}`)),
        h(Text, { style: s.muted }, ed.year))),
      base.languages?.length ? h(Text, { style: { marginTop: 2 } }, "Languages: " + base.languages.map((l: any) => `${l.language} (${l.level})`).join(" · ")) : null
    )
  );
  return renderToBuffer(doc as any);
}
