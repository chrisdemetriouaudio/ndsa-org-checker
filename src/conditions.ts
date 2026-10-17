/**
 * The conditions in scope, and the exact phrases that count as a match.
 * Phrases are deliberately narrow: "sensory processing", not "sensory" (which usually means deaf or blind
 * services); "Down syndrome", not "Down" (a county and many place names); no bare "ADD" or "tic".
 */
export interface Condition {
  key: string;
  label: string;
  re: RegExp;
}

export const CONDITIONS: Condition[] = [
  { key: 'autism', label: 'autism', re: /\bautis(?:m|tic|ts?)\b|\basperger/i },
  { key: 'adhd', label: 'ADHD', re: /\bA\.?D\.?H\.?D\b|attention[- ]deficit/i },
  { key: 'tourette', label: 'Tourette syndrome', re: /\btourette|\btic disorders?\b/i },
  { key: 'dyslexia', label: 'dyslexia', re: /\bdyslexi/i },
  { key: 'dyscalculia', label: 'dyscalculia', re: /\bdyscalcul/i },
  { key: 'dysgraphia', label: 'dysgraphia', re: /\bdysgraph/i },
  { key: 'dyspraxia', label: 'dyspraxia (DCD)', re: /\bdyspraxi|developmental co-?ordination disorder/i },
  { key: 'dld', label: 'developmental language disorder', re: /developmental language disorder|\bDLD\b|specific language impairment/ },
  { key: 'spd', label: 'sensory processing', re: /sensory processing|sensory integration/i },
  { key: 'prosopagnosia', label: 'prosopagnosia', re: /prosopagnosi|face[- ]blindness/i },
  { key: 'synaesthesia', label: 'synaesthesia', re: /\bsyn(?:a)?esthe/i },
  { key: 'ocd', label: 'OCD', re: /obsessive[- ]compulsive|\bOCD\b/i },
  { key: 'learning-disability', label: 'learning disability', re: /learning disabilit|intellectual disabilit/i },
  { key: 'down-syndrome', label: 'Down syndrome', re: /\bdown'?s'? syndrome/i },
  { key: 'williams-syndrome', label: 'Williams syndrome', re: /\bwilliams syndrome/i },
  { key: 'fragile-x', label: 'Fragile X syndrome', re: /\bfragile[- ]x\b/i },
  { key: 'brain-injury', label: 'brain injury', re: /\bbrain injur|\bheadway\b/i },
  { key: 'neurodiversity', label: 'neurodiversity', re: /\bneuro-?divers|\bneurodivergen/i },
];

export interface Match {
  conditions: string[]; // labels
  inName: boolean;
  snippet: string; // the words around the first match, so a person can judge it
}

/** Which conditions a name and description mention, and where. Null when none do. */
export function matchConditions(name: string, description: string): Match | null {
  const conditions: string[] = [];
  let inName = false;
  let first: { text: string; index: number; length: number } | null = null;
  for (const c of CONDITIONS) {
    const n = c.re.exec(name);
    const d = c.re.exec(description);
    if (!n && !d) continue;
    conditions.push(c.label);
    if (n) inName = true;
    const hit = n ? { text: name, index: n.index, length: n[0].length } : { text: description, index: d!.index, length: d![0].length };
    if (!first || (hit.text === name && first.text !== name)) first = hit;
  }
  if (!conditions.length || !first) return null;
  const from = Math.max(0, first.index - 70);
  const to = Math.min(first.text.length, first.index + first.length + 70);
  const snippet = `${from > 0 ? '…' : ''}${first.text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < first.text.length ? '…' : ''}`;
  return { conditions, inName, snippet };
}
