/**
 * Competitor registry (docs/RULES_V0.md section 13, approved definition):
 * businesses, not domains, with their own locations per municipality and
 * whether they offer the measured service. Used by organic_gap.
 *
 * A business counts as a local competitor in a municipality only when all of
 * these are verified: a direct rental type, an operational own location
 * (branch or headquarters, not a legal/mail address only) whose address
 * matches the municipality by name, and the measured service (at that
 * location for chains and mixed businesses). Anything missing is
 * "unverified", never "absent".
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { normalizeDomain } from "@/lib/dataforseo/parse";

const sourceSchema = z.object({ url: z.string().min(1), quote: z.string().optional() });

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
});

const businessSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  domains: z.array(z.string().min(3)).min(1),
  type: z.enum(businessTypes),
  /** Does the business offer the measured service (e.g. aerial work platform rental)? */
  measuredService: z.object({ status: z.enum(["verified", "not_verified"]), sources: z.array(sourceSchema).default([]) }),
  /** complete: the business's own location list was read in full. */
  locationsReviewed: z.object({ status: z.enum(["complete", "partial", "not_reviewed"]), sources: z.array(sourceSchema).default([]) }),
  locations: z.array(locationSchema).default([]),
  approved: z.boolean().default(false),
  notes: z.string().optional(),
});

export const registrySchema = z.object({
  measuredService: z.string().min(1),
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

/**
 * Official municipality name without the Destatis suffix: "Ulm, Universitätsstadt"
 * → "Ulm", "Babenhausen, M" → "Babenhausen". The address city must equal it
 * exactly (case, ß/ss, hyphen and space aside); "Neu-Ulm" ≠ "Ulm",
 * "Heidenheim" ≠ "Heidenheim an der Brenz". The postal code is never the key.
 */
export function addressMatchesMunicipality(city: string, officialName: string): boolean {
  return norm(city) === norm(officialName.split(",")[0]);
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
      return b.locationsReviewed.status === "complete" ? out("not_listed", "no_own_location_in_municipality") : out("unverified", "locations_not_fully_reviewed");
    }
    const matched = here.filter((l) => addressMatchesMunicipality(l.address.city, officialName));
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
