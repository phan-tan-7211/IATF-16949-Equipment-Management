import { z } from 'zod'

const NonEmpty = z.string().trim().min(1)
const OptionalText = z.string().trim().optional()
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo YYYY-MM-DD')

export const CalibrationInstrumentStatusSchema = z.enum(['ACTIVE', 'HOLD', 'OUT_OF_SERVICE'])
export const CalibrationDueStatusSchema = z.enum(['VALID', 'DUE_SOON', 'OVERDUE', 'NO_PLAN'])

export const CalibrationMasterSchema = z.object({
  calibrationEquipmentId: NonEmpty,
  equipmentId: OptionalText,
  controlNumber: OptionalText,
  department: OptionalText,
  category: OptionalText,
  instrumentName: NonEmpty,
  localName: OptionalText,
  operationalStatus: z.enum(['OK', 'NG', 'UNKNOWN']).default('UNKNOWN'),
  specification: OptionalText,
  accuracy: OptionalText,
  model: OptionalText,
  manufacturer: OptionalText,
  serialNumber: OptionalText,
  purpose: OptionalText,
  lastCalibrationDate: IsoDate.optional(),
  nextDueDate: IsoDate.optional(),
  instrumentStatus: CalibrationInstrumentStatusSchema.default('ACTIVE'),
  active: z.boolean(),
})

export const CalibrationVendorQuoteSchema = z.object({
  calibrationEquipmentId: NonEmpty,
  provider: NonEmpty,
  amountVnd: z.number().int().nonnegative(),
  sourceDate: IsoDate,
  sourceDocument: NonEmpty,
})

export const CalibrationQuoteSummarySchema = z.object({
  provider: NonEmpty,
  itemCount: z.number().int().nonnegative(),
  subtotalVnd: z.number().int().nonnegative(),
  vatRate: z.number().min(0).max(1),
  totalVnd: z.number().int().nonnegative(),
  sourceDate: IsoDate,
})

export type CalibrationMaster = z.infer<typeof CalibrationMasterSchema>
export type CalibrationDueStatus = z.infer<typeof CalibrationDueStatusSchema>
export type CalibrationVendorQuote = z.infer<typeof CalibrationVendorQuoteSchema>
export type CalibrationQuoteSummary = z.infer<typeof CalibrationQuoteSummarySchema>

const DAY_MS = 24 * 60 * 60 * 1000

export function getCalibrationDueStatus(
  nextDueDate: string | undefined,
  asOfDate: string,
  dueSoonDays = 30,
): CalibrationDueStatus {
  if (!nextDueDate) return 'NO_PLAN'

  const due = new Date(`${nextDueDate}T00:00:00Z`)
  const asOf = new Date(`${asOfDate}T00:00:00Z`)
  const daysUntilDue = Math.ceil((due.getTime() - asOf.getTime()) / DAY_MS)

  if (daysUntilDue < 0) return 'OVERDUE'
  if (daysUntilDue <= dueSoonDays) return 'DUE_SOON'
  return 'VALID'
}
