/**
 * Row builders for the behaviour matrix: an INSERT of a draft, a proforma, an
 * issued invoice or a correction with the seed's values, where a case overrides
 * only the columns it exercises.
 */

export const draftWith = (id, overrides) => {
  const base = {
    county: "'RO-IS'", sector: "NULL", series: "'INV'", status: "'draft'",
    sourceApp: "NULL", sourceKind: "NULL", sourceId: "NULL",
    ...overrides,
  }
  return `INSERT INTO invoice_drafts(id,organization_id,customer_id,customer_party_type,customer_legal_name,
    customer_tax_identifier,customer_country_code,customer_city,customer_street,customer_county,customer_sector,
    customer_postal_code,customer_vat_registered,series,issue_date,due_date,currency,status,
    source_app,source_kind,source_id)
    VALUES('${id}','org-1','customer-1','company','Client SRL','87654329','RO','Iasi','Strada 2',
    ${base.county},${base.sector},NULL,1,${base.series},'2026-09-01',NULL,'RON',${base.status},
    ${base.sourceApp},${base.sourceKind},${base.sourceId})`
}

export const proformaWith = (id, number, overrides) => {
  const base = { issuerCounty: "'RO-IS'", issuerSector: "NULL", sourceApp: "NULL", ...overrides }
  return `INSERT INTO proformas(id,source_draft_id,organization_id,fiscal_year,document_type,series,number,
    issue_date,due_date,issued_at,currency,issuer_legal_name,issuer_tax_identifier,issuer_country_code,
    issuer_city,issuer_street,issuer_county,issuer_sector,issuer_postal_code,customer_party_type,
    customer_legal_name,customer_tax_identifier,customer_country_code,customer_city,customer_street,
    customer_county,customer_sector,customer_postal_code,customer_vat_registered,total_excluding_tax,
    tax_total,total_including_tax,sealed,issuer_legal_form,issuer_trade_registry_number,issuer_iban,
    issuer_bank_name,issuer_social_capital,actor_id,issuer_vat_registered,source_app,source_kind,source_id)
    VALUES('${id}',NULL,'org-1',2026,'proforma','PRO',${number},'2026-09-01',NULL,
    '2026-09-01T10:00:00.000Z','RON','Furnizor SRL','12345674','RO','Iasi','Strada 1',
    ${base.issuerCounty},${base.issuerSector},NULL,'company','Client SRL','87654329','RO','Iasi','Strada 2',
    'RO-IS',NULL,NULL,1,10000,2100,12100,0,'srl','J22/123/2020','RO49','Banca',100000,
    'operator',1,${base.sourceApp},NULL,NULL)`
}

export const invoiceWith = (id, number, overrides) => {
  const base = {
    draftId: "NULL", proformaId: "NULL", supplyDate: "'2026-09-01'",
    issuerCounty: "'RO-IS'", issuerSector: "NULL", sourceApp: "NULL", ...overrides,
  }
  return `INSERT INTO issued_invoices(id,draft_id,organization_id,fiscal_year,document_type,series,number,
    issue_date,due_date,supply_date,issued_at,currency,issuer_legal_name,issuer_tax_identifier,issuer_country_code,
    issuer_city,issuer_street,issuer_county,issuer_sector,issuer_postal_code,customer_legal_name,
    customer_tax_identifier,customer_country_code,customer_city,customer_street,customer_county,
    customer_sector,customer_postal_code,total_excluding_tax,tax_total,total_including_tax,
    customer_party_type,customer_vat_registered,source_proforma_id,issuer_legal_form,
    issuer_trade_registry_number,issuer_iban,issuer_bank_name,issuer_social_capital,actor_id,
    issuer_vat_registered,source_app,source_kind,source_id)
    VALUES('${id}',${base.draftId},'org-1',2026,'invoice','INV',${number},'2026-09-01',NULL,${base.supplyDate},
    '2026-09-01T10:00:00.000Z','RON','Furnizor SRL','12345674','RO','Iasi','Strada 1',
    ${base.issuerCounty},${base.issuerSector},NULL,'Client SRL','87654329','RO','Iasi','Strada 2',
    'RO-IS',NULL,NULL,10000,2100,12100,'company',1,${base.proformaId},'srl','J22/123/2020',
    'RO49','Banca',100000,'operator',1,${base.sourceApp},NULL,NULL)`
}

export const correctionWith = (id, number, overrides) => {
  const base = { issuerCounty: "'RO-IS'", issuerSector: "NULL", sourceApp: "NULL", ...overrides }
  return `INSERT INTO correction_documents(id,organization_id,original_invoice_id,fiscal_year,document_type,
    series,number,issue_date,issued_at,reason,currency,issuer_legal_name,issuer_tax_identifier,
    issuer_country_code,issuer_city,issuer_street,issuer_county,issuer_sector,issuer_postal_code,
    customer_legal_name,customer_tax_identifier,customer_country_code,customer_city,customer_street,
    customer_county,customer_sector,customer_postal_code,total_excluding_tax,tax_total,total_including_tax,
    customer_party_type,customer_vat_registered,issuer_legal_form,issuer_trade_registry_number,issuer_iban,
    issuer_bank_name,issuer_social_capital,actor_id,issuer_vat_registered,source_app,source_kind,source_id)
    VALUES('${id}','org-1','invoice-1',2026,'correction','INV',${number},'2026-09-02',
    '2026-09-02T10:00:00.000Z','Eroare','RON','Furnizor SRL','12345674','RO','Iasi','Strada 1',
    ${base.issuerCounty},${base.issuerSector},NULL,'Client SRL','87654329','RO','Iasi','Strada 2',
    'RO-IS',NULL,NULL,-10000,-2100,-12100,'company',1,'srl','J22/123/2020','RO49','Banca',
    100000,'operator',1,${base.sourceApp},NULL,NULL)`
}

export const LINE_TAIL = "'Servicii','1.00',10000,'RO_STANDARD','S','21.00',NULL,10000,2100,12100,'C62','unitate'"
