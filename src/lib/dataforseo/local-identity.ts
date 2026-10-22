/**
 * Local Pack identity helpers (docs/RULES_V0.md section 10).
 *
 * Two independent questions, never mixed:
 * - Which Google profile is this entry? `cid` (DataForSEO field) or the
 *   Google id ("/g/…") inside the searchviewer `svid` parameter.
 * - Where is it? Street, house number, postal code and city, compared
 *   field by field with a verified address.
 *
 * svid decoding is reverse-engineered from live responses (21.10.2026), not
 * documented by Google or DataForSEO: base64url protobuf → field 2 → field 2
 * → {1: "pvq", 2: base64 protobuf → field 1: "/g/…"}. Anything else yields
 * no id ("undecodable"), never a guess. Whether the id is stable over time
 * and unique per profile is an assumption, not verified beyond the pilot.
 */

export type ProfileIdStatus = "decoded" | "absent" | "undecodable";

export interface ProfileIdResult {
  /** svid exactly as found in the URL, or null. */
  svid: string | null;
  googleId: string | null;
  status: ProfileIdStatus;
}

type Field = { no: number; value: number | Uint8Array };

function readVarint(b: Uint8Array, pos: number): [number, number] | null {
  let result = 0;
  let shift = 0;
  for (let i = pos; i < b.length && shift <= 49; i++) {
    result += (b[i] & 0x7f) * 2 ** shift;
    if ((b[i] & 0x80) === 0) return [result, i + 1];
    shift += 7;
  }
  return null;
}

/** Varint and length-delimited fields only; anything else or trailing garbage → null. */
function readMessage(b: Uint8Array): Field[] | null {
  const fields: Field[] = [];
  let pos = 0;
  while (pos < b.length) {
    const tag = readVarint(b, pos);
    if (!tag) return null;
    const [key, next] = tag;
    const no = Math.floor(key / 8);
    const wire = key % 8;
    if (no === 0) return null;
    if (wire === 0) {
      const v = readVarint(b, next);
      if (!v) return null;
      fields.push({ no, value: v[0] });
      pos = v[1];
    } else if (wire === 2) {
      const len = readVarint(b, next);
      if (!len || len[1] + len[0] > b.length) return null;
      fields.push({ no, value: b.subarray(len[1], len[1] + len[0]) });
      pos = len[1] + len[0];
    } else {
      return null;
    }
  }
  return fields;
}

/** The single length-delimited field `no`; none or several → null. */
function onlyBytes(fields: Field[] | null, no: number): Uint8Array | null {
  const hits = (fields ?? []).filter((f) => f.no === no);
  return hits.length === 1 && hits[0].value instanceof Uint8Array ? hits[0].value : null;
}

const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

function base64Bytes(s: string): Uint8Array | null {
  if (!BASE64.test(s)) return null;
  return new Uint8Array(Buffer.from(s, "base64"));
}

const text = (b: Uint8Array | null) => (b ? new TextDecoder("utf-8", { fatal: false }).decode(b) : null);

const GOOGLE_ID = /^\/[gm]\/[0-9a-z_]+$/;

/**
 * Two layouts are known from live responses; anything else gives null (never a guess).
 * A (21.10.2026): outer.2 → .2 → { 1: "pvq", 2: base64({ 1: id }) }
 * B (22.10.2026): outer.2 → .5 → { 1: id }
 */
export function decodeSvid(svid: string): string | null {
  const outer = base64Bytes(svid);
  const level1 = outer && readMessage(onlyBytes(readMessage(outer), 2) ?? new Uint8Array());
  if (!level1) return null;
  const valid = (id: string | null) => (id && GOOGLE_ID.test(id) ? id : null);

  const layoutA = onlyBytes(level1, 2);
  if (layoutA) {
    const entry = readMessage(layoutA);
    if (!entry || text(onlyBytes(entry, 1)) !== "pvq") return null;
    const encoded = text(onlyBytes(entry, 2));
    const payload = encoded && base64Bytes(encoded);
    return valid(payload && text(onlyBytes(readMessage(payload), 1)));
  }
  const layoutB = onlyBytes(level1, 5);
  if (layoutB) return valid(text(onlyBytes(readMessage(layoutB), 1)));
  return null;
}

export function profileIdFromUrl(url: string | null): ProfileIdResult {
  let svid: string | null = null;
  try {
    svid = url ? new URL(url).searchParams.get("svid") : null;
  } catch {
    svid = null;
  }
  if (!svid) return { svid: null, googleId: null, status: "absent" };
  const googleId = decodeSvid(svid);
  return { svid, googleId, status: googleId ? "decoded" : "undecodable" };
}

// ── Addresses ───────────────────────────────────────────────────────────

export interface PostalAddress {
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
}

export const ADDRESS_FIELDS = ["street", "houseNumber", "postalCode", "city"] as const;
export type AddressField = (typeof ADDRESS_FIELDS)[number];

const STREET = /^(\p{L}[\p{L}\p{M}.'’\- ]*?[\p{L}.])\s+(\d{1,4}\s?[a-zA-Z]?(?:\s?[/-]\s?\d{1,4}\s?[a-zA-Z]?)?)$/u;
const POSTAL_CITY = /^(\d{5})\s+(\p{L}.*)$/u;

/**
 * Address parts in a Local Pack snippet such as "Baumaschinenvermietung ·
 * Gartenstraße 14 · Schließt um 17:00" or "Mühlweg 21, 73001 Musterdorf".
 * Parts that are absent stay null; two different street candidates → none.
 */
export function addressFromSnippet(snippet: string | null): PostalAddress | null {
  if (!snippet) return null;
  const segments = snippet
    .split(/[·•\n|]/)
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  const streets = new Map<string, [string, string]>();
  let postal: [string, string] | null = null;
  for (const s of segments) {
    const pc = POSTAL_CITY.exec(s);
    if (pc) {
      postal ??= [pc[1], pc[2].trim()];
      continue;
    }
    const st = STREET.exec(s);
    if (st && st[1].replace(/[^\p{L}]/gu, "").length >= 3) streets.set(`${normalizeStreet(st[1])}|${normalizeHouseNumber(st[2])}`, [st[1].trim(), st[2].trim()]);
  }
  const street = streets.size === 1 ? [...streets.values()][0] : null;
  if (!street && !postal) return null;
  return { street: street?.[0] ?? null, houseNumber: street?.[1] ?? null, postalCode: postal?.[0] ?? null, city: postal?.[1] ?? null };
}

/** Spelling only (case, ß/ss, "Str."), never drops words: different streets stay different. */
export function normalizeStreet(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/str\.(?=\s|$)/g, "strasse")
    .replace(/[\s-]+/g, " ")
    .trim();
}

/** "25 / 7" → "25/7", "14 A" → "14a"; suffixes are kept, so 25 ≠ 25/7 ≠ 25a. */
export function normalizeHouseNumber(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export function normalizeCity(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/ß/g, "ss").replace(/[\s-]+/g, " ").trim();
}

const NORMALIZE: Record<AddressField, (s: string) => string> = {
  street: normalizeStreet,
  houseNumber: normalizeHouseNumber,
  postalCode: (s) => s.trim(),
  city: normalizeCity,
};

export interface AddressComparison {
  /**
   * full: all four parts present on both sides and exactly equal · partial:
   * house number equal and street equal or only "uncertain", nothing differs,
   * but not full · conflict: a part present on both sides differs ·
   * insufficient: street or house number missing.
   */
  result: "full" | "partial" | "conflict" | "insufficient";
  matched: AddressField[];
  /**
   * Snippets often glue the business category to the street ("Ausrüstungsverleih
   * Mühlweg 21"), so the street start is unknown. A verified street that is
   * only the trailing words of the observed text is "uncertain": it could also be
   * a different street ("Alte Hauptstraße" vs "Hauptstraße") and never counts as full.
   */
  uncertain: AddressField[];
  differing: AddressField[];
  missing: AddressField[];
}

export function compareAddress(observed: PostalAddress | null, verified: PostalAddress): AddressComparison {
  const matched: AddressField[] = [];
  const uncertain: AddressField[] = [];
  const differing: AddressField[] = [];
  const missing: AddressField[] = [];
  for (const f of ADDRESS_FIELDS) {
    const a = observed?.[f];
    const b = verified[f];
    if (!a || !b) missing.push(f);
    else if (NORMALIZE[f](a) === NORMALIZE[f](b)) matched.push(f);
    else if (f === "street" && ` ${NORMALIZE.street(a)}`.endsWith(` ${NORMALIZE.street(b)}`)) uncertain.push(f);
    else differing.push(f);
  }
  const streetOk = matched.includes("street") || uncertain.includes("street");
  const result = differing.length
    ? "conflict"
    : !streetOk || !matched.includes("houseNumber")
      ? "insufficient"
      : matched.length === ADDRESS_FIELDS.length
        ? "full"
        : "partial";
  return { result, matched, uncertain, differing, missing };
}
