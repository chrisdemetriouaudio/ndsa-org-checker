/**
 * Decides what to do with a discovered candidate, with reasons a person can read:
 *   add        – clearly a support organisation for one of our conditions (still needs a working website)
 *   review     – unclear; a person decides
 *   reject     – clearly not a signposting fit (care or housing provider, school, grant-maker, overseas...)
 *   no-website – would be added, but there is no website to check it against
 *   parked     – left aside: its website is gone, or it was still unclear after PARK_UNCLEAR_AFTER_DAYS. Never added.
 * Pure and deterministic, so the same rules run on the backlog, every morning, and in tests.
 */
import { CONDITIONS } from './conditions.ts';

export type Verdict = 'add' | 'review' | 'reject' | 'no-website' | 'parked';

export interface Triage {
  score: number; // 0–100: how clearly it is a support organisation for our conditions
  verdict: Verdict;
  reasons: string[];
}

export interface TriageInput {
  name: string;
  description: string; // the register's own words
  inName: boolean; // a condition is in the name
  conditions: string[];
  website: string | null;
  how?: string; // the register's own tick-boxes for how the charity works, e.g. "Provides services; Makes grants"
}

export const ADD_AT = 50;
export const REJECT_AT = 15;
/** Still unclear this many days after it was first found: parked, not added. Nobody has to decide it. */
export const PARK_UNCLEAR_AFTER_DAYS = 7;

/** Organisations whose name carries no condition but whose movement is about one. */
const KNOWN_NAMES = /\b(mencap|people first|headway|gateway club|enable\b|autistic society|aspie|asd\w*|sen\b|send\b|neuro\w*)/i;

const SUPPORT = /\b(support\w*|peer|self[- ]advocacy|advocacy|parents?|famil(?:y|ies)|carers?|advice|information|befriend\w*|social|activit(?:y|ies)|helpline|drop[- ]in|workshops?|clubs?|groups?|awareness|signpost\w*|coffee mornings?|play ?schemes?|sessions|recreation\w*|friendship|fun|leisure|music|drama|arts?|sports?|riding|holidays?|work experience|training|employment|volunteer\w*|counselling|wellbeing|interest group)\b/i;

const NOT_A_FIT: [RegExp, number, string][] = [
  [/\b(care homes?|nursing homes?|residential (?:care|homes?|services?|accommodation|placements?)|supported (?:living|housing)|domiciliary|registered care|care providers?|personal care services|24[- ]hour support|housing associations?|registered social landlord|provision of (?:housing|accommodation)|accommodation (?:and|with|for)\b|provides? (?:\w+ ){0,3}accommodation|(?:running|run|runs) (?:of )?(?:care )?homes|homes and services|registered with (?:the )?(?:cqc|care inspectorate))/i, 50, 'runs care or housing (a provider, not a signposting service)'],
  [/\b((?:an? |the |our )?(?:independent|special|residential|free|day) (?:special )?schools?|academy trust|a school for|our school|the school|the college|specialist college)\b/i, 35, 'runs a school or college'],
  [/\b(makes? grants|making grants|awarding grants|grant[- ]making|grants to (?:organisations|charities|other charities)|almshouses?|donations are made|scholarships?|bursar(?:y|ies)|benevolent fund)\b/i, 40, 'gives grants rather than support'],
  [/\b(community (?:centre|association|hall)s?|benefits? advice|food ?banks?|luncheon clubs?|lunch clubs? for (?:the )?(?:elderly|older))\b/i, 15, 'a general community service'],
  [/\b(?:orphanages?|overseas|abroad|(?:in|across|throughout) (?:romania|ukraine|moldova|africa|asia|india|ghana|kenya|nigeria|uganda|pakistan|bangladesh|zambia|malawi|sri lanka|nepal|the developing world|developing countries))\b/i, 40, 'works overseas'],
  [/\b(church|parish|chapel|mosque|synagogue|diocese|gurdwara|temple|ministr(?:y|ies))\b/i, 30, 'a faith organisation for whom support is not the main purpose'],
  [/\b((?:medical|scientific) research|fund(?:ing|s)? research|research into)\b/i, 15, 'mainly funds research'],
];

const OTHER_GROUPS = /\b(elderly|older people|dementia|physical(?:ly)? disabl\w*|mental (?:ill)?health|homeless\w*|addiction|substance|ex-offenders|offenders|refugees|asylum|stroke|cancer|sensory impairment|visual(?:ly)? impair\w*|blind|deaf\w*|hearing loss|domestic abuse|unemploy\w*|poverty|bereave\w*|veterans)\b/gi;

/** How clearly this is a support organisation for one of our conditions, and what to do with it. */
export function triage(c: TriageInput): Triage {
  const reasons: string[] = [];
  const text = c.description;
  let score = 0;

  if (c.inName) { score += 60; reasons.push(`named for ${c.conditions[0]}`); }
  else if (KNOWN_NAMES.test(c.name)) { score += 55; reasons.push('a known organisation for one of our conditions (for example Mencap, Headway, a Gateway club)'); }

  // Where the description first mentions one of our conditions (same exact-phrase rules as discovery).
  const firstMention = Math.min(...CONDITIONS.map((cond) => {
    const m = cond.re.exec(text);
    return m ? m.index : Infinity;
  }));
  if (firstMention < 120) { score += 35; reasons.push('the condition is what its description is about'); }
  else if (firstMention < 250) { score += 20; reasons.push('the condition comes early in what it does'); }
  else if (firstMention < Infinity) { score += 5; }

  // "Supported living" and similar describe care, not support a family can be signposted to.
  const supportText = text.replace(/\bsupported (?:living|housing|accommodation|employment placements?)\b/gi, '');
  if (SUPPORT.test(supportText) || SUPPORT.test(c.name)) { score += 15; reasons.push('offers support, advice, groups or activities'); }

  const others = new Set((text.match(OTHER_GROUPS) ?? []).map((w) => w.toLowerCase()));
  if (others.size >= 4) { score -= 25; reasons.push(`serves many different groups (${[...others].slice(0, 4).join(', ')}…)`); }

  for (const [re, penalty, why] of NOT_A_FIT) {
    if (re.test(text) || re.test(c.name)) { score -= penalty; reasons.push(why); }
  }

  // Tie-breaker: when the words alone leave it unclear, the register's own tick-boxes for how it works decide.
  const between = score > REJECT_AT && score < ADD_AT;
  if (between && c.how) {
    const how = registerHow(c.how);
    const providerFlag = reasons.some((r) => NOT_A_FIT.some(([, , why]) => why === r));
    if (how.housing) { score -= 20; reasons.push('the register says it provides accommodation or housing'); }
    else if (how.grants && !how.services && !how.advice) { score -= 30; reasons.push('the register says it gives grants rather than running services'); }
    else if (how.research && !how.services && !how.advice) { score -= 20; reasons.push('the register says it mainly does research'); }
    else if (how.advice && !providerFlag) { score += 15; reasons.push('the register says it gives advice, advocacy or information'); }
  }

  score = Math.max(0, Math.min(100, score));
  let verdict: Verdict = score >= ADD_AT ? 'add' : score <= REJECT_AT ? 'reject' : 'review';
  if (verdict === 'add' && !c.website) verdict = 'no-website';
  return { score, verdict, reasons };
}

/** The register's "how it works" tick-boxes (any of the three UK registers), as plain yes/no facts. */
export function registerHow(text: string) {
  const t = text.toLowerCase();
  return {
    services: /provides services|carries out activities or services itself|counselling\/support|sport\/recreation|playgroup/.test(t),
    advice: /advice|advocacy/.test(t),
    grants: /grant|other finance|welfare\/benevolent|loans/.test(t),
    research: /research/.test(t),
    housing: /accommodation\/housing/.test(t),
  };
}
