import { readClientCache } from './clientDataCache'
import { supabase } from './supabaseClient'
import type { EquipmentCriticalityFacts } from './autoRegistration'

export type LiveEquipment = {
  equipmentId: string
  equipmentName: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  equipmentCategory: string
  manufacturer: string
  model: string
  serialNumber: string
  currentArea: string
  currentLine: string
  managingDepartment: string
  managementResponsiblePrimary?: string
  managementResponsibleSecondary?: string
  usingDepartment: string
  technicalSpecification: string
  description: string
  accuracy: string
  origin: string
  manufactureDate: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  relatedDocuments: string
  status: string
  criticality: string
  criticalityFacts?: EquipmentCriticalityFacts
  qrCode: string
  active: boolean
  updatedAt: string
}

const EQUIPMENT_CACHE_KEY = 'cev:data:equipment-master'
const EQUIPMENT_CACHE_VERSION = 1

function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim() }
function bool(value: unknown) { return typeof value === 'boolean' ? value : ['TRUE', '1', 'YES'].includes(text(value).toUpperCase()) }
function sourceText(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return ''
  return text((source as Record<string, unknown>)[key])
}
function sourceObject(source: unknown, key: string) {
  if (!source || typeof source !== 'object') return {} as Record<string, unknown>
  const value = (source as Record<string, unknown>)[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}
function sourceBoolean(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'boolean' ? value : undefined
}

export function normalizeEquipmentRow(row: Record<string, unknown>): LiveEquipment | null {
  const equipmentId = text(row.equipment_id ?? row.equipmentId)
  const equipmentType = text(row.equipment_type ?? row.equipmentType).toUpperCase()
  if (!equipmentId || !['PRODUCTION', 'MEASUREMENT'].includes(equipmentType)) return null
  const source = row.source_data ?? row.sourceData
  const criticalityFacts = sourceObject(source, 'criticalityFacts')
  return {
    equipmentId,
    equipmentName: text(row.equipment_name ?? row.equipmentName) || equipmentId,
    equipmentType: equipmentType as LiveEquipment['equipmentType'],
    equipmentCategory: text(row.equipmentCategory) || sourceText(source, 'equipmentCategory'),
    manufacturer: text(row.manufacturer),
    model: text(row.model),
    serialNumber: text(row.serial_number ?? row.serialNumber),
    currentArea: text(row.currentArea) || sourceText(source, 'currentArea'),
    currentLine: text(row.currentLine) || sourceText(source, 'currentLine'),
    managingDepartment: text(row.managingDepartment) || sourceText(source, 'managingDepartment'),
    managementResponsiblePrimary: text(row.managementResponsiblePrimary) || sourceText(source, 'managementResponsiblePrimary'),
    managementResponsibleSecondary: text(row.managementResponsibleSecondary) || sourceText(source, 'managementResponsibleSecondary'),
    usingDepartment: text(row.department ?? row.usingDepartment) || sourceText(source, 'usingDepartment'),
    technicalSpecification: text(row.technicalSpecification) || sourceText(source, 'technicalSpecification'),
    description: sourceText(source, 'description'),
    accuracy: sourceText(source, 'accuracy'),
    origin: sourceText(source, 'origin') || sourceText(source, 'countryOfOrigin'),
    manufactureDate: sourceText(source, 'manufactureDate'),
    inServiceDate: sourceText(source, 'inServiceDate'),
    warrantyUntil: sourceText(source, 'warrantyUntil'),
    warrantyContact: sourceText(source, 'warrantyContact'),
    note: sourceText(source, 'note'),
    relatedDocuments: sourceText(source, 'relatedDocuments'),
    status: text(row.status) || 'RUNNING',
    criticality: text(row.criticality) || sourceText(source, 'criticality'),
    criticalityFacts: {
      controlsProductQuality: sourceBoolean(criticalityFacts, 'controlsProductQuality'),
      specialCharacteristicImpact: sourceBoolean(criticalityFacts, 'specialCharacteristicImpact'),
      stopsProduction: sourceBoolean(criticalityFacts, 'stopsProduction'),
      hasBackup: sourceBoolean(criticalityFacts, 'hasBackup'),
      capacityImpact: sourceBoolean(criticalityFacts, 'capacityImpact'),
    },
    qrCode: text(row.qr_code ?? row.qrCode) || equipmentId,
    active: row.active === undefined ? true : bool(row.active),
    updatedAt: text(row.updated_at ?? row.updatedAt),
  }
}

export async function loadLiveEquipment(options: { force?: boolean } = {}) {
  if (!options.force) {
    const cached = readClientCache<LiveEquipment[]>(EQUIPMENT_CACHE_KEY, EQUIPMENT_CACHE_VERSION)
    if (cached?.data?.length) return cached.data
  }
  const { data, error } = await supabase.from('equipment_master').select('*').order('equipment_id')
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map(normalizeEquipmentRow).filter((row): row is LiveEquipment => Boolean(row))
}
