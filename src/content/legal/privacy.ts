/**
 * Datenschutzerklärung (German, authoritative). Single source for the
 * privacy page in every locale; EN/TR show a note plus this text.
 *
 * Describes only what the site actually does (checked 21.10.2026 on
 * https://ortsrank.foundercheck.de): no forms, no cookies, no analytics or
 * ad trackers, no third-party resources (fonts are self-hosted), hosting
 * on Vercel, contact by e-mail. Update the version and date with every
 * change, and before adding forms, accounts, reports or analytics.
 */
import { operator } from "@/config/operator";

export const privacyVersion = "1.0";
export const privacyUpdatedAt = "21.10.2026";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export const privacySections: LegalSection[] = [
  {
    heading: "1. Verantwortlicher",
    paragraphs: [
      `${operator.company}, ${operator.street}, ${operator.postalCity}, ${operator.country}. Vertreten durch den Geschäftsführer ${operator.managingDirector}. E-Mail: ${operator.email}, Telefon: ${operator.phone}.`,
    ],
  },
  {
    heading: "2. Überblick",
    paragraphs: [
      "Diese Website informiert über Ortsrank. Sie enthält keine Formulare und kein Benutzerkonto, setzt keine Cookies, verwendet keine Analyse- oder Werbe-Tracker und lädt keine Inhalte von Drittanbietern. Schriftarten werden von unserem eigenen Server ausgeliefert.",
    ],
  },
  {
    heading: "3. Hosting und Server-Logdaten",
    paragraphs: [
      "Die Website wird bei Vercel Inc. (USA) gehostet. Beim Aufruf einer Seite verarbeitet Vercel technisch notwendige Daten, insbesondere IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse, Browser-Typ und die Spracheinstellung des Browsers. Das ist erforderlich, um die Website auszuliefern, ihren Betrieb zu sichern und Missbrauch abzuwehren. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und funktionsfähigen Angebot (Art. 6 Abs. 1 lit. f DSGVO).",
      "Die Spracheinstellung deines Browsers nutzen wir nur, um dich beim ersten Aufruf auf die passende Sprachversion (Deutsch, Englisch oder Türkisch) weiterzuleiten. Wir speichern sie nicht.",
      "Vercel kann Daten auch in den USA verarbeiten. Vercel ist nach dem EU-US Data Privacy Framework zertifiziert; die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission dazu (Art. 45 DSGVO).",
    ],
  },
  {
    heading: "4. Kontakt per E-Mail",
    paragraphs: [
      "Wenn du uns eine E-Mail schreibst, verarbeiten wir deine Adresse und den Inhalt deiner Nachricht, um deine Anfrage zu beantworten (Art. 6 Abs. 1 lit. b DSGVO, wenn es um einen Vertrag geht, sonst Art. 6 Abs. 1 lit. f DSGVO). Wir löschen die Nachricht, wenn die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
    ],
  },
  {
    heading: "5. Deine Rechte",
    paragraphs: [
      "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit (Art. 15–20 DSGVO). Einer Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, widersprechen (Art. 21 DSGVO). Schreib uns dazu an die oben genannte E-Mail-Adresse.",
      "Du kannst dich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, zum Beispiel beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit.",
    ],
  },
  {
    heading: "6. Änderungen",
    paragraphs: [
      "Wenn wir neue Funktionen anbieten, etwa Berichte, Kundenzugänge oder eine Reichweitenmessung, passen wir diese Datenschutzerklärung vorher an.",
    ],
  },
];
