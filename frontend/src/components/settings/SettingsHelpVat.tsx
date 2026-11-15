import { HelpItem, HelpSection } from "./SettingsHelpEntries.tsx"

/**
 * The VAT half of the field guide. It is kept apart from the identity half
 * because it states the one rule the screen cannot enforce: which rate an
 * operation actually falls under is a fiscal judgement, not a setting.
 */
export const SettingsHelpVat = () => <>
  <HelpSection title="Configurația TVA">
    <HelpItem term="Plătitoare de TVA">Regimul este ales explicit din această bifă. Forma în care introduci CUI-ul nu îl schimbă.</HelpItem>
    <HelpItem term="Cote și cod TVA">Nu se completează aici: alegerea regimului scrie configurația standard, iar renunțarea scrie scutirea conform art. 310.</HelpItem>
    <HelpItem term="Schimbarea regimului se aplică de la" highlight>Configurația este aleasă după <strong>data emiterii facturii</strong>, nu după ziua în care salvezi setările. O poți programa din timp: vechea cotă rămâne valabilă până în ziua precedentă. Facturile deja emise nu se modifică, iar liniile existente într-un draft își păstrează cota și primesc un avertisment.</HelpItem>
    <HelpItem term="Istoric regim TVA">Perioadele trecute sunt afișate doar pentru consultare. Se modifică numai regimul curent, printr-o schimbare cu dată de aplicare.</HelpItem>
  </HelpSection>
  <HelpSection title="Cote TVA folosite în România"
    note="Aplicația permite configurarea cotelor speciale, dar nu stabilește automat încadrarea fiscală. Operațiunile scutite nu trebuie tratate automat ca „TVA 0%”. Informațiile au fost verificate la 1 septembrie 2026 din Codul fiscal și materialele ANAF.">
    <HelpItem term="21% — cota standard">Se aplică operațiunilor taxabile care nu intră într-un regim redus sau de scutire.</HelpItem>
    <HelpItem term="11% — cota redusă">Poate fi aplicabilă unor categorii speciale, precum alimente eligibile, medicamente, apă, cărți, cazare și servicii de restaurant/catering. Încadrarea exactă depinde de produs sau serviciu.</HelpItem>
    <HelpItem term="9% — regim tranzitoriu special">La 1 septembrie 2026 mai poate fi aplicabilă numai anumitor locuințe care îndeplinesc condițiile legale, cu termen tranzitoriu până la 30 septembrie 2026. <strong>Nu este cota generală pentru alimente.</strong></HelpItem>
  </HelpSection>
</>
