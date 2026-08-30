import { supabase } from './supabaseClient'

export type QrEquipmentIndexItem = {
  equipmentId: string
  equipmentName: string
  equipmentType: 'PRODUCTION' | 'MEASUREMENT'
  status: string
}

const CANONICAL_EQUIPMENT_ID = /CEV-(?:PR|ME)-\d{3}/i

export function parseEquipmentIdFromQr(rawValue: string) {
  const raw = rawValue.trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    const queryId = url.searchParams.get('equipment') || url.searchParams.get('equipmentId') || ''
    const queryMatch = queryId.match(CANONICAL_EQUIPMENT_ID)
    if (queryMatch) return queryMatch[0].toUpperCase()
  } catch {
    // Raw QR values are expected to fail URL parsing.
  }

  const match = raw.match(CANONICAL_EQUIPMENT_ID)
  return match ? match[0].toUpperCase() : ''
}

export async function loadQrEquipmentIndex(): Promise<QrEquipmentIndexItem[]> {
  const { data, error } = await supabase
    .from('equipment_master')
    .select('equipment_id,equipment_name,equipment_type,status')
    .eq('active', true)
    .order('equipment_id')

  if (error) throw new Error(`QR_EQUIPMENT_INDEX_FAILED: ${error.message}`)

  return (data || []).map((row) => ({
    equipmentId: String(row.equipment_id || ''),
    equipmentName: String(row.equipment_name || row.equipment_id || ''),
    equipmentType: row.equipment_type as QrEquipmentIndexItem['equipmentType'],
    status: String(row.status || 'UNKNOWN'),
  }))
}
