/**
 * The county names behind the ISO 3166-2 codes a sealed document carries.
 *
 * `validateParty` (cube) refuses any county that is not one of these codes, so
 * every snapshot this screen reads stores `RO-B`, `RO-BT`, `RO-CJ` and never a
 * name. Printing the code would put `RO-B` on a fiscal document where the law
 * and the legacy client both read `București`, so the mapping is part of the
 * presentation rather than of the contract. The list itself comes from the
 * server (`GET /api/reference-data`). An unknown code is returned as it
 * arrived: inventing a name for a code the list does not know would be worse
 * than showing what the backend actually stored.
 */
export interface RomanianCounty {
  readonly code: string
  readonly name: string
}

export const romanianCountyName = (code: string, counties: ReadonlyArray<RomanianCounty>): string =>
  counties.find((county) => county.code === code)?.name ?? code

const comparable = (name: string): string => name.normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s-]+/gu, "").toLowerCase()

/**
 * The county's name for an address line, absent when the city already says it
 * (`București`, `RO-B`). Unlike the PDF, an unknown code is shown as stored
 * rather than dropped: the document view has always shown it (T-1400).
 */
export const addressCountyName = (
  city: string, county: string, counties: ReadonlyArray<RomanianCounty>,
): string | undefined => {
  const name = romanianCountyName(county, counties)
  return comparable(name) === comparable(city) ? undefined : name
}

export const isRomanianCountyCode = (code: string, counties: ReadonlyArray<RomanianCounty>): boolean =>
  counties.some((county) => county.code === code)

export const countyRequiresSector = (county: string): boolean => county === "RO-B"
