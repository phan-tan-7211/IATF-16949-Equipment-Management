import { supabase } from './supabaseClient'

export type OrgUnit = {
  unitCode: string
  unitName: string
  unitType: string
  parentUnitCode: string
}

export type OrgPerson = {
  personCode: string
  displayName: string
  unitCode: string
  jobTitle: string
}

export type OrgLocation = {
  locationCode: string
  locationName: string
  locationType: 'AREA' | 'LINE'
  unitCode: string
}

export type OrgResolvedAssignment = {
  equipmentId: string
  primaryRoleCode: string
  primaryRoleName: string
  primaryPersonCode: string
  primaryPersonName: string
  secondaryPersonCode: string
  secondaryPersonName: string
  managingUnitCode: string
  managingUnitName: string
  usingUnitCode: string
  usingUnitName: string
  areaCode: string
  areaName: string
  lineCode: string
  lineName: string
}

export type OrgMasterSnapshot = {
  units: OrgUnit[]
  people: OrgPerson[]
  locations: OrgLocation[]
  resolvedAssignments: OrgResolvedAssignment[]
}

let cache: OrgMasterSnapshot | null = null
let inFlight: Promise<OrgMasterSnapshot> | null = null

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'))
}

export function getOrgMasterSnapshot() {
  return cache
}

export function getOrgAutocompleteOptions(columnKey: string) {
  if (!cache) return []
  if (columnKey === 'managingDepartment' || columnKey === 'usingDepartment') {
    return unique(cache.units.filter((unit) => !['COMPANY', 'TEAM'].includes(unit.unitType)).map((unit) => unit.unitName))
  }
  if (columnKey === 'managementResponsiblePrimary' || columnKey === 'managementResponsibleSecondary') {
    return unique(cache.people.map((person) => person.displayName))
  }
  if (columnKey === 'currentArea') {
    return unique(cache.locations.filter((location) => location.locationType === 'AREA').map((location) => location.locationName))
  }
  if (columnKey === 'currentLine') {
    return unique(cache.locations.filter((location) => location.locationType === 'LINE').map((location) => location.locationName))
  }
  return []
}

export async function loadOrgMaster(options: { force?: boolean } = {}) {
  if (!options.force && cache) return cache
  if (!options.force && inFlight) return inFlight

  inFlight = (async () => {
    const [unitsResult, peopleResult, locationsResult, resolvedResult] = await Promise.all([
      supabase.from('org_units').select('unit_code,unit_name,unit_type,parent_unit_code').eq('active', true).order('sort_order'),
      supabase.from('org_people').select('person_code,display_name,unit_code,job_title').eq('active', true).order('display_name'),
      supabase.from('org_locations').select('location_code,location_name,location_type,unit_code').eq('active', true).order('sort_order'),
      supabase.from('equipment_org_resolved').select('*'),
    ])

    const firstError = unitsResult.error || peopleResult.error || locationsResult.error || resolvedResult.error
    if (firstError) throw firstError

    cache = {
      units: (unitsResult.data || []).map((row) => ({
        unitCode: text(row.unit_code),
        unitName: text(row.unit_name),
        unitType: text(row.unit_type),
        parentUnitCode: text(row.parent_unit_code),
      })),
      people: (peopleResult.data || []).map((row) => ({
        personCode: text(row.person_code),
        displayName: text(row.display_name),
        unitCode: text(row.unit_code),
        jobTitle: text(row.job_title),
      })),
      locations: (locationsResult.data || []).map((row) => ({
        locationCode: text(row.location_code),
        locationName: text(row.location_name),
        locationType: text(row.location_type) === 'LINE' ? 'LINE' : 'AREA',
        unitCode: text(row.unit_code),
      })),
      resolvedAssignments: (resolvedResult.data || []).map((row) => ({
        equipmentId: text(row.equipment_id),
        primaryRoleCode: text(row.primary_role_code),
        primaryRoleName: text(row.primary_role_name),
        primaryPersonCode: text(row.primary_person_code),
        primaryPersonName: text(row.primary_person_name),
        secondaryPersonCode: text(row.secondary_person_code),
        secondaryPersonName: text(row.secondary_person_name),
        managingUnitCode: text(row.managing_unit_code),
        managingUnitName: text(row.managing_unit_name),
        usingUnitCode: text(row.using_unit_code),
        usingUnitName: text(row.using_unit_name),
        areaCode: text(row.area_code),
        areaName: text(row.area_name),
        lineCode: text(row.line_code),
        lineName: text(row.line_name),
      })),
    }
    return cache
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}
