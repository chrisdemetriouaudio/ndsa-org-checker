/**
 * WebAuthn core for @simplewebauthn/server v14, copied from Genesis (genesis-auth/src/lib/webauthn.ts).
 * Pure functions: no storage. Policy is explicit, never left to library defaults:
 *
 *  - registration: discoverable credential REQUIRED (residentKey: required),
 *    user verification REQUIRED, attestation "none", NO authenticator-attachment
 *    restriction (built-in authenticators, security keys and phones all allowed);
 *  - authentication: user verification REQUIRED; username-less (no
 *    allowCredentials) for sign-in, account-scoped list only for signed-in step-up;
 *  - counters: the library's documented behaviour (counter 0 → 0 is fine for
 *    synced passkeys; a counter that goes backwards is rejected).
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { b64urlDecode, b64urlEncode } from "./crypto.ts";

export interface RelyingParty {
  rpID: string;
  rpName: string;
  origin: string;
}

/** A new random 32-byte WebAuthn user handle (base64url) — never a name, e-mail or slug. */
export function newUserHandle(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b64urlEncode(b);
}


export async function registrationOptions(
  rp: RelyingParty,
  user: { handle: string; name: string; displayName: string },
  exclude: { id: string; transports?: string[] }[]
) {
  return generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userID: b64urlDecode(user.handle),
    userName: user.name,
    userDisplayName: user.displayName,
    attestationType: "none",
    excludeCredentials: exclude,
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    extensions: { credProps: true } as Record<string, unknown>,
  });
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKey: string; // base64url COSE
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  discoverable: boolean | null;
}

/** Verify an attestation. Throws nothing: returns null for any failure. */
export async function verifyRegistration(rp: RelyingParty, response: RegistrationResponseJSON, challenge: string): Promise<VerifiedRegistration | null> {
  try {
    const v = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      expectedType: "webauthn.create",
      requireUserPresence: true,
      requireUserVerification: true,
    });
    if (!v.verified || !v.registrationInfo || !v.registrationInfo.userVerified) return null;
    const info = v.registrationInfo;
    const rk = (response.clientExtensionResults as { credProps?: { rk?: boolean } } | undefined)?.credProps?.rk;
    return {
      credentialId: info.credential.id,
      publicKey: b64urlEncode(info.credential.publicKey),
      counter: info.credential.counter,
      transports: (response.response?.transports as string[] | undefined)?.filter((t) => typeof t === "string").slice(0, 8) ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      discoverable: typeof rk === "boolean" ? rk : null,
    };
  } catch {
    return null;
  }
}

export async function authenticationOptions(rp: RelyingParty, allow?: { id: string; transports?: string[] }[]) {
  return generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    ...(allow && allow.length ? { allowCredentials: allow } : {}),
  });
}

export interface VerifiedAssertion {
  newCounter: number;
  deviceType: string;
  backedUp: boolean;
}

/** Verify an assertion against a stored credential. Returns null for any failure. */
export async function verifyAssertion(
  rp: RelyingParty,
  response: AuthenticationResponseJSON,
  challenge: string,
  credential: { id: string; publicKey: string; counter: number; transports?: string[] }
): Promise<VerifiedAssertion | null> {
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      expectedType: "webauthn.get",
      credential: { id: credential.id, publicKey: b64urlDecode(credential.publicKey), counter: credential.counter, transports: credential.transports },
      requireUserVerification: true,
    });
    if (!v.verified || !v.authenticationInfo.userVerified) return null;
    return { newCounter: v.authenticationInfo.newCounter, deviceType: v.authenticationInfo.credentialDeviceType, backedUp: v.authenticationInfo.credentialBackedUp };
  } catch {
    return null;
  }
}

/** Minimal structural checks before handing client JSON to the library. */
export function looksLikeAssertion(r: unknown): r is AuthenticationResponseJSON {
  const x = r as AuthenticationResponseJSON;
  return !!x && typeof x === "object" && typeof x.id === "string" && x.id.length <= 1024 && x.type === "public-key" && !!x.response && typeof x.response === "object"
    && typeof x.response.clientDataJSON === "string" && typeof x.response.authenticatorData === "string" && typeof x.response.signature === "string";
}
export function looksLikeAttestation(r: unknown): r is RegistrationResponseJSON {
  const x = r as RegistrationResponseJSON;
  return !!x && typeof x === "object" && typeof x.id === "string" && x.id.length <= 1024 && x.type === "public-key" && !!x.response && typeof x.response === "object"
    && typeof x.response.clientDataJSON === "string" && typeof x.response.attestationObject === "string";
}
