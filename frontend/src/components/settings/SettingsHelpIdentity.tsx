import { HelpItem, HelpSection } from "./SettingsHelpEntries.tsx"

/**
 * The identity half of the field guide: what each legal field means and when it
 * becomes mandatory. The sentences are the legacy dialog's, verified against the
 * Codul fiscal and ANAF materials on 1 September 2026.
 */
export const SettingsHelpIdentity = () => <>
  <HelpSection title="Identificarea firmei">
    <HelpItem term="CUI / identificator fiscal">Poate fi introdus cu sau fără prefixul „RO”. Prefixul introdus este eliminat, nu modifică regimul TVA, iar cifra de control este verificată la salvare.</HelpItem>
    <HelpItem term="Formă juridică">Alege explicit SRL sau PFA. Aplicația nu presupune automat o formă juridică pentru un profil nou.</HelpItem>
    <HelpItem term="Nr. Registrul Comerțului">Acceptă formatul clasic, de exemplu „J40/1234/2020”, sau identificatorul nou format din J/F și 13 cifre. Poți salva temporar câmpul gol, dar emiterea cere această informație.</HelpItem>
    <HelpItem term="Capital social">Sumă în RON, cu maximum 16 cifre întregi și două zecimale. Este necesară la emitere pentru SRL, nu și pentru PFA.</HelpItem>
    <HelpItem term="IBAN și bancă">Sunt opționale. Spațiile din IBAN sunt eliminate la salvare, literele devin majuscule și cifra de control este verificată.</HelpItem>
    <HelpItem term="Județ și cod poștal">Județul este obligatoriu, codul poștal este opțional; ambele completează adresa fiscală afișată în documentele emise.</HelpItem>
  </HelpSection>
  <HelpSection title="Brand documente">
    <HelpItem term="Text de brand">O linie de maximum 80 de caractere, tipărită lângă datele firmei. Câmpul gol înseamnă „fără text de brand”.</HelpItem>
    <HelpItem term="Siglă">PNG sau JPEG, maximum 256 KiB, 2048 px pe axă și 4 megapixeli. Imaginea este recodificată PNG la salvare. Un fișier respins trebuie înlocuit sau abandonat înainte de salvare.</HelpItem>
  </HelpSection>
  <HelpSection title="Valori implicite pentru facturi">
    <HelpItem term="Monedă implicită">În această versiune facturile sunt emise în RON, de aceea moneda este fixă.</HelpItem>
    <HelpItem term="Termen de plată">Numărul de zile folosit pentru calcularea automată a scadenței atunci când nu alegi manual o dată.</HelpItem>
  </HelpSection>
  <HelpSection title="Serii de documente">
    <HelpItem term="Tip document">Seriile pentru Factură și Proformă sunt configurate separat. La crearea unei facturi poți alege numai o serie de tip Factură.</HelpItem>
    <HelpItem term="Serie">Prefixul numărului documentului, de exemplu „FCT” în „FCT 123”. O serie nu se redenumește și nu se șterge; una pe care nu o mai folosești o arhivezi, iar numerotarea ei continuă la reactivare.</HelpItem>
    <HelpItem term="Seria draftului">Seria se salvează în draft și se poate schimba cât draftul e deschis, doar către o serie activă de factură. La emitere se alocă următorul număr fiscal din seria salvată.</HelpItem>
  </HelpSection>
</>
