/**
 * Competitor registry (docs/RULES_V0.md section 13, approved definition):
 * businesses, not domains, with their own locations per municipality and
 * whether they offer the measured service. Used by organic_gap.
 *
 * A business counts as a local competitor in a municipality only when all of
 * these are verified: a direct rental type, an operational own location
 * (branch or headquarters, not a legal/mail address only) whose address is
 * tied to the municipality (official name, or an abbreviation backed by
 * recorded evidence), and the measured service (at that location for chains
 * and mixed businesses). Anything missing is "unverified", never "absent".
 *
 * Absence: "no location here" only when the business's own comprehensive
 * location list (a Standorte/Niederlassungen page) was read. An Impressum or
 * a single address proves nothing about other locations.
 *
 * Scope: the registry stores only locations in the measured municipalities;
 * other locations are described in notes, not as entries.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { normalizeDomain } from "@/lib/dataforseo/parse";

/** quote: verbatim text only; note: our own description of what the source shows. */
const sourceSchema = z.object({ url: z.string().min(1), quote: z.string().optional(), note: z.string().optional() });

export const businessTypes = ["rental", "rental_chain", "mixed", "network", "portal", "directory", "manufacturer", "unknown"] as const;
export type BusinessType = (typeof businessTypes)[number];

/** Not direct rental competitors: shown apart, never counted. */
export const EXCLUDED_TYPES: readonly BusinessType[] = ["network", "portal", "directory", "manufacturer"];
/** Several kinds of business at one place: the measured service must be verified at the location itself. */
const SERVICE_PER_LOCATION: readonly BusinessType[] = ["rental_chain", "mixed"];

const locationSchema = z.object({
  /** AGS of the municipality the reviewer assigned; checked against the address below. */
  ags: z.string().regex(/^\d{8}$/),
  kind: z.enum(["branch", "headquarters", "legal_only"]),
  address: z.object({
    street: z.string().min(1),
    houseNumber: z.string().min(1),
    postalCode: z.string().regex(/^\d{5}$/),
    /** Municipality as written in the source; a district of it goes to `district`. */
    city: z.string().min(1),
    district: z.string().optional(),
  }),
  serviceAtLocation: z.enum(["verified", "not_verified"]).default("not_verified"),
  sources: z.array(sourceSchema).min(1),
  /**
   * Needed when the address city is not the official name but an abbreviation of
   * it ("Heidenheim" for "Heidenheim an der Brenz"): sources that tie this address
   * to this municipality (e.g. the same address with the full name elsewhere).
   */
  municipalityEvidence: z.array(sourceSchema).optional(),
});

const businessSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  domains: z.array(z.string().min(3)).min(1),
  type: z.enum(businessTypes),
  /** Does the business offer the measured service (e.g. aerial work platform rental)? */
  measuredService: z.object({ status: z.enum(["verified", "not_verified"]), sources: z.array(sourceSchema).default([]) }),
  /**
   * comprehensive_list: the business's own location page (Standorte, Niederlassungen,
   * Mietstationen) was read in full; only then may "no location here" be concluded.
   * partial: some own pages read (Impressum, single address, JS finder, …).
   */
  locationsReviewed: z.object({ status: z.enum(["comprehensive_list", "partial", "not_reviewed"]), sources: z.array(sourceSchema).default([]) }),
  locations: z.array(locationSchema).default([]),
  approved: z.boolean().default(false),
  notes: z.string().optional(),
});

export const registrySchema = z.object({
  measuredService: z.string().min(1),
  /** Locations stored per business: only those in the measured municipalities. */
  locationScope: z.literal("measured_municipalities"),
  businesses: z.array(businessSchema),
});

export type Business = z.infer<typeof businessSchema>;
export type CompetitorRegistry = z.infer<typeof registrySchema>;

export function readRegistry(path: string): CompetitorRegistry {
  const r = registrySchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`invalid competitor registry ${path}: ${i.path.join(".")}: ${i.message}`);
  }
  const seen = new Map<string, string>();
  for (const b of r.data.businesses) {
    for (const d of b.domains.map(normalizeDomain)) {
      if (seen.has(d)) throw new Error(`invalid competitor registry ${path}: domain ${d} in ${seen.get(d)} and ${b.id}`);
      seen.set(d, b.id);
    }
  }
  return r.data;
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/ß/g, "ss").replace(/[\s-]+/g, " ").trim();

export type MunicipalityMatch = "exact" | "abbreviation" | "no";

/**
 * Address city against the official municipality name without the Destatis
 * suffix ("Ulm, Universitätsstadt" → "Ulm"). exact: same name (case, ß/ss,
 * hyphen and space aside). abbreviation: the city is the leading word(s) of a
 * longer official name ("Heidenheim" → "Heidenheim an der Brenz"); it may stand
 * only with recorded evidence. Anything else is no match: "Neu-Ulm" ≠ "Ulm".
 * The postal code is never the key.
 */
export function matchMunicipality(city: string, officialName: string): MunicipalityMatch {
  const a = norm(city);
  const b = norm(officialName.split(",")[0]);
  if (a === b) return "exact";
  return a.length > 0 && b.startsWith(`${a} `) ? "abbreviation" : "no";
}

/** True only for an exact name match (no evidence needed). */
export function addressMatchesMunicipality(city: string, officialName: string): boolean {
  return matchMunicipality(city, officialName) === "exact";
}

export type CompetitorStatus = "qualifies" | "excluded_type" | "not_listed" | "unverified";

export interface CompetitorAssessment {
  /** Business id, or `domain:<domain>` for a domain not in the registry. */
  business: string;
  status: CompetitorStatus;
  reason: string | null;
  approved: boolean;
}

export class CompetitorIndex {
  private byDomain = new Map<string, Business>();

  constructor(readonly registry: CompetitorRegistry) {
    for (const b of registry.businesses) for (const d of b.domains) this.byDomain.set(normalizeDomain(d), b);
  }

  business(domain: string): Business | null {
    return this.byDomain.get(normalizeDomain(domain)) ?? null;
  }

  /** Is the domain's business a verified local competitor in this municipality? */
  assess(domain: string, ags: string, officialName: string): CompetitorAssessment {
    const b = this.business(domain);
    if (!b) return { business: `domain:${normalizeDomain(domain)}`, status: "unverified", reason: "not_in_registry", approved: false };
    const out = (status: CompetitorStatus, reason: string | null): CompetitorAssessment => ({ business: b.id, status, reason, approved: b.approved });
    if (EXCLUDED_TYPES.includes(b.type)) return out("excluded_type", b.type);
    if (b.type === "unknown") return out("unverified", "type_unknown");

    const here = b.locations.filter((l) => l.ags === ags);
    if (here.length === 0) {
      return b.locationsReviewed.status === "comprehensive_list"
        ? out("not_listed", "not_in_own_location_list")
        : out("unverified", "no_location_found_in_reviewed_sources");
    }
    const matched = here.filter((l) => {
      const m = matchMunicipality(l.address.city, officialName);
      return m === "exact" || (m === "abbreviation" && (l.municipalityEvidence?.length ?? 0) > 0);
    });
    if (matched.length === 0) return out("unverified", "municipality_match_unclear");
    const operational = matched.filter((l) => l.kind !== "legal_only");
    if (operational.length === 0) return out("unverified", "legal_address_only");
    if (b.measuredService.status !== "verified") return out("unverified", "service_not_verified");
    if (SERVICE_PER_LOCATION.includes(b.type) && !operational.some((l) => l.serviceAtLocation === "verified")) {
      return out("unverified", "service_at_location_not_verified");
    }
    return out("qualifies", null);
  }
}
