/**
 * The live Charity Commission register (England and Wales), used by the checker when CCEW_API_KEY is set.
 * Without the key, or if the API is slow or down, everything here returns null and the checker uses the
 * morning's lookup files instead. Answers are cached at the edge for an hour, so a busy day costs few calls.
 */
import { CCEW_API, detailsExtra, detailsToEntry, pickByName, type CcewDetails, type CcewExtra, type CcewFound } from '../src/ccew.ts';
import type { LookupEntry } from '../src/lookupKeys.ts';
import type { Env } from './auth.ts';

async function ask<T>(env: Env, path: string): Promise<T | null> {
  if (!env.CCEW_API_KEY) return null;
  try {
    const res = await fetch(`${CCEW_API}/${path}`, {
      headers: { 'Ocp-Apim-Subscription-Key': env.CCEW_API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) { await res.body?.cancel(); return null; }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Today's register entry for an England and Wales charity number, plus what only the live register knows. */
export async function liveCharity(env: Env, number: string): Promise<{ entry: LookupEntry; extra: CcewExtra } | null> {
  if (!/^\d{5,8}$/.test(number)) return null; // Scottish (SC…) and Northern Irish numbers are not on this register
  const [details, grants] = await Promise.all([
    ask<CcewDetails>(env, `allcharitydetailsV2/${number}/0`),
    ask<{ primary_purpose_grant_making: boolean | null }>(env, `checkprimarygrants/${number}/0`),
  ]);
  if (!details?.reg_charity_number) return null;
  const extra = detailsExtra(details, grants?.primary_purpose_grant_making ?? null);
  if (details.reg_status === 'RM' && !extra.removalReason) {
    // The details do not always say why; the registration history usually does.
    const history = await ask<{ event_group: string; reg_desc: string; event_reason: string | null }[]>(env, `charityregistrationhistory/${number}/0`);
    const removal = history?.filter((h) => /remov/i.test(`${h.event_group} ${h.reg_desc}`)).pop();
    extra.removalReason = removal?.event_reason?.trim() || null;
  }
  return { entry: detailsToEntry(details), extra };
}

/** The charity with exactly this name, if the register has one (used when its website is not on the register). */
export async function charityByName(env: Env, name: string): Promise<CcewFound | null> {
  const found = await ask<CcewFound[]>(env, `searchCharityName/${encodeURIComponent(name.slice(0, 100))}`);
  return Array.isArray(found) ? pickByName(found, name) : null;
}
