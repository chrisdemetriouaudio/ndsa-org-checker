/**
 * Map points for organisations' postcodes, from postcodes.io (free, open data, no key).
 * Only postcodes without a point yet are looked up, 100 per request, one request at a time.
 */
import type { Org } from './types.ts';

const API = 'https://api.postcodes.io';
const BATCH = 100;
const round = (n: number) => Math.round(n * 1000) / 1000; // about 100 m: plenty for "miles away"

type Point = { lat: number; lon: number; council?: string };

async function lookupBatch(postcodes: string[]): Promise<Map<string, Point>> {
  const res = await fetch(`${API}/postcodes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'ndsa-org-checker/0.1 (+https://github.com/chrisdemetriouaudio/ndsa-org-checker)' },
    body: JSON.stringify({ postcodes }),
  });
  if (!res.ok) throw new Error(`postcodes.io: HTTP ${res.status}`);
  const j = (await res.json()) as { result: { query: string; result: { latitude: number | null; longitude: number | null; admin_district?: string | null } | null }[] };
  const out = new Map<string, Point>();
  for (const r of j.result) {
    if (r.result?.latitude != null && r.result.longitude != null) out.set(r.query, { lat: round(r.result.latitude), lon: round(r.result.longitude), council: r.result.admin_district ?? undefined });
  }
  return out;
}

/** An old (terminated) postcode has no point, but its district does: "SO23 9XX" -> "SO23". */
async function lookupDistrict(postcode: string): Promise<Point | null> {
  const res = await fetch(`${API}/outcodes/${encodeURIComponent(postcode.split(' ')[0])}`);
  if (!res.ok) return null;
  const j = (await res.json()) as { result: { latitude: number | null; longitude: number | null } | null };
  return j.result?.latitude != null && j.result.longitude != null ? { lat: round(j.result.latitude), lon: round(j.result.longitude) } : null;
}

/** Fills in lat/lon for organisations that have a postcode but no point. Returns how many it filled. */
export async function addMapPoints(orgs: Org[]): Promise<number> {
  const missing = [...new Set(orgs.filter((o) => o.postcode && o.lat == null).map((o) => o.postcode!))];
  const points = new Map<string, Point>();
  for (let i = 0; i < missing.length; i += BATCH) {
    for (const [k, v] of await lookupBatch(missing.slice(i, i + BATCH))) points.set(k, v);
  }
  for (const pc of missing.filter((p) => !points.has(p))) {
    const p = await lookupDistrict(pc);
    if (p) points.set(pc, p);
  }
  let filled = 0;
  for (const o of orgs) {
    const p = o.postcode ? points.get(o.postcode) : undefined;
    if (p && o.lat == null) {
      o.lat = p.lat; o.lon = p.lon;
      // A local organisation with no service areas on its register serves at least its own council.
      if (!o.serves?.length && o.coverage !== 'national' && p.council) o.serves = [p.council];
      filled++;
    }
  }
  return filled;
}
