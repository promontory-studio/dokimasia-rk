// A pre-registration is the thing a benchmark commits BEFORE it spends anything: what is claimed,
// what will be measured, on what, and — the part that is easy to skip and the reason the rest
// matters — what each possible outcome will be taken to mean.
//
// This module owns the SHAPE and the rendering. The text is the host's: only the host knows what it
// claimed. Holding the registration as a value rather than as prose in two places is what makes
// "--preview prints exactly what the page says" a fact a test can check instead of a promise.
export interface PreRegistrationSection {
  heading: string;
  body: string;
}

export interface PreRegistration {
  /** ISO date the registration was committed — before the run, or it is not a registration. */
  committed: string;
  /** Where the house rules it is written against live, if anywhere. */
  authority?: { label: string; url: string };
  sections: PreRegistrationSection[];
}

const wrap = (text: string, width: number, indent: string): string => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > width) {
      lines.push(line);
      line = indent + w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
};

/** Markdown, wrapped at `width`, identical whether it is printed by a --preview or committed to a
 *  page. Both must come from here or the claim that they match is unverifiable. */
export function renderPreRegistration(p: PreRegistration, width = 98): string {
  const head = p.authority
    ? `Pre-registration — recorded before the run, ${p.committed}, per [\`${p.authority.label}\`](${p.authority.url}).`
    : `Pre-registration — recorded before the run, ${p.committed}.`;
  const bullets = p.sections.map((s) => `- ${wrap(`**${s.heading}.** ${s.body}`, width, "  ")}`);
  return [wrap(head, width, ""), "", ...bullets].join("\n");
}
