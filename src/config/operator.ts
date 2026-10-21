/**
 * Legal operator details (Impressum, footer). Single source; values match
 * the Impressum on foundercheck.de, which TechNS UG also operates.
 * Not translated: company name, address and register entries are legal facts.
 */
export const operator = {
  company: "TechNS UG (haftungsbeschränkt)",
  street: "Ludwig-Erhard-Str. 16A",
  postalCity: "61440 Oberursel (Taunus)",
  country: "Deutschland",
  managingDirector: "Halil Yaprakli",
  registerCourt: "Amtsgericht Bad Homburg",
  registerNumber: "HRB 16236",
  vatId: "DE312006599",
  phone: "+49 6171 277 51 37",
  email: "info@dgitmarkt.de",
} as const;

/** `tel:` link target, e.g. "+4961712775137". */
export const operatorPhoneHref = `tel:${operator.phone.replace(/\s+/g, "")}`;
