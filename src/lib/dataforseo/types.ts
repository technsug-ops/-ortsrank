/**
 * Zod schemas for the DataForSEO SERP Google Organic Live Advanced response.
 * Only fields we read are declared; unknown fields are ignored. The raw
 * response is always stored unchanged before parsing (CLAUDE.md principle 3).
 * Docs: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced.md
 */
import { z } from "zod";

export const STATUS_OK = 20000;

const nullableString = z.string().nullish().transform((v) => v ?? null);
const nullableNumber = z.number().nullish().transform((v) => v ?? null);

/**
 * Only `type` is required here, so one odd item cannot invalidate the whole
 * response; type-specific fields are checked per type in the parser.
 */
export const itemSchema = z.looseObject({ type: z.string() });

export const organicItemSchema = z.object({
  rank_group: z.number().int(),
  rank_absolute: z.number().int(),
  domain: nullableString,
  url: nullableString,
  title: nullableString,
});

export const paidItemSchema = organicItemSchema.extend({
  position: nullableString,
});

export const localPackItemSchema = organicItemSchema.extend({
  phone: nullableString,
  is_paid: z.boolean().nullish().transform((v) => v ?? false),
  rating: z
    .object({ value: nullableNumber, votes_count: nullableNumber })
    .nullish()
    .transform((v) => v ?? null),
  cid: nullableString,
  /** Snippet text; may carry category, street and house number, opening hours. */
  description: nullableString,
});

export const resultSchema = z.object({
  keyword: z.string(),
  check_url: nullableString,
  datetime: nullableString,
  items: z.array(itemSchema).nullish().transform((v) => v ?? []),
});

export const taskSchema = z.object({
  id: z.string(),
  status_code: z.number().int(),
  status_message: z.string(),
  cost: nullableNumber,
  data: z.looseObject({ depth: z.number().int().optional() }).nullish(),
  result: z.array(resultSchema).nullish().transform((v) => v ?? []),
});

export const responseSchema = z.object({
  status_code: z.number().int(),
  status_message: z.string(),
  cost: nullableNumber,
  tasks: z.array(taskSchema).nullish().transform((v) => v ?? []),
});

export type DfsResponse = z.infer<typeof responseSchema>;
export type DfsTask = z.infer<typeof taskSchema>;
export type DfsItem = z.infer<typeof itemSchema>;
