/**
 * Where an organisation is: its base postcode (the registered office, not always where groups meet),
 * the map point for it, and whether it works locally or across a whole nation.
 */
export type Coverage = 'local' | 'national';
export type Nation = 'England' | 'Wales' | 'Scotland' | 'Northern Ireland';
export const NATIONS: Nation[] = ['England', 'Wales', 'Scotland', 'Northern Ireland'];

/** A full UK postcode, tidied ("sw1a1aa" → "SW1A 1AA"); null if it is not one. */
export function ukPostcode(raw: unknown): string | null {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(s);
  return m ? `${m[1]} ${m[2]}` : null;
}

/** The first UK postcode inside a line of address text. */
export function postcodeIn(text: unknown): string | null {
  const m = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i.exec(String(text ?? ''));
  return m ? ukPostcode(`${m[1]}${m[2]}`) : null;
}

/** Straight-line distance in miles between two map points. */
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** England & Wales areas of operation: "Throughout England (And Wales)" or "Throughout Wales" means nationwide. */
export const ccewCoverage = (areas: string[]): Coverage =>
  areas.some((a) => /^throughout (england|wales)/i.test(a)) ? 'national' : 'local';

/** Scottish register "Geographical Spread". */
export const oscrCoverage = (spread: string): Coverage =>
  /all or most of scotland|scotland and other parts of the uk|uk and overseas/i.test(spread) ? 'national' : 'local';

/** Northern Ireland has no coverage field: nationwide only when the description says so. */
export const ccniCoverage = (text: string): Coverage =>
  /\b(across|throughout|all (?:of|parts of)) northern ireland\b|\bNI[- ]wide\b|\bregional (?:charity|organisation|service)\b/i.test(text) ? 'national' : 'local';

/** Council and area names compared loosely: "Manchester City" = "Manchester", "City of Edinburgh" = "Edinburgh". */
export function areaKey(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and')
    .replace(/^(the )?(city and county of|city of|county of|royal borough of|london borough of|borough of)\s+/, '')
    .replace(/\s+(city|county|borough|council|city council|county council|district)$/, '')
    .replace(/[^a-z]+/g, ' ').trim();
}

/** Where the visitor is, as postcodes.io names it. */
export interface Here { district?: string | null; county?: string | null; region?: string | null; country: string }

/**
 * Whether an organisation's listed service areas cover the visitor: their council, their county,
 * "Throughout London" for London, or "Throughout <their nation>". Returns the matching area, or null.
 */
export function servesHere(serves: string[] | undefined, here: Here): string | null {
  if (!serves?.length) return null;
  const mine = new Set([here.district, here.county].filter(Boolean).map((x) => areaKey(x!)));
  for (const s of serves) {
    const k = areaKey(s);
    if (mine.has(k)) return s;
    const throughout = /^throughout (.+)$/.exec(k)?.[1];
    if (throughout && (throughout === areaKey(here.region ?? '') || throughout.split(' and ').includes(here.country.toLowerCase()))) return s;
  }
  return null;
}
