/**
 * Who an organisation is for: children and young people, adults, and/or families and carers.
 * Worked out from the registers' own categories plus exact phrases in the description. When nothing
 * says, the list stays empty ("ages not stated") rather than guessing.
 */
export type Audience = 'children' | 'adults' | 'families';
export const AUDIENCES: Audience[] = ['children', 'adults', 'families'];
export const AUDIENCE_LABEL: Record<Audience, string> = {
  children: 'Children and young people',
  adults: 'Adults',
  families: 'Families and carers',
};

const TEXT: Record<Audience, RegExp> = {
  children: /\b(?:child(?:ren)?|young (?:people|person|adults?)|youth|kids|teen(?:age(?:rs?)?|s)?|pupils?|schools?|early years|pre-?school|toddlers?|bab(?:y|ies)|infants?|under[- ]?(?:5|11|16|18|19|25)s?|aged \d{1,2} ?(?:to|-|–) ?(?:1\d|2[0-5]))\b/i,
  adults: /\b(?:adults?|grown[- ]?ups?|over[- ]?(?:16|18|19|25)s?|aged (?:16|18|19|25) ?(?:and over|plus|\+)|18\+|older people|elderly|later life|workplace|employment|employers?)\b/i,
  families: /\b(?:famil(?:y|ies)|parent(?:s|ing)?|carers?|siblings?|grandparents?|kinship)\b/i,
};

/** Register categories that clearly name a group (England and Wales, Scotland, Northern Ireland). */
const CATEGORY: Record<Audience, RegExp> = {
  children: /children\/young people|children or young people|children \(5-13|youth \(14-25|preschool \(0-5/i,
  adults: /elderly\/old people|older people|adult training/i,
  families: /\bparents\b|\bcarers\b/i,
};

/** Audiences named in free text and/or register categories, in a fixed order. */
export function inferAudiences(text: string, categories = ''): Audience[] {
  return AUDIENCES.filter((a) => TEXT[a].test(text) || (categories && CATEGORY[a].test(categories)));
}

/** Keeps only known audiences, in order, without repeats. */
export const cleanAudiences = (list: unknown): Audience[] =>
  Array.isArray(list) ? AUDIENCES.filter((a) => list.map(String).includes(a)) : [];
