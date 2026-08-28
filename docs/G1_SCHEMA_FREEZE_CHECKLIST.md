# Gate G1 — Schema Freeze Checklist

Status: **FROZEN — sẵn sàng mở Google persistence**

Freeze date: **2026-08-28**

## 1. Mapping source → schema/UI/report

- BM-TBSX-01/02 → Equipment Master/Profile.
- BM-KTTBHN → Daily Inspection + escalation V/○/△/X.
- BM-TBSX-03/07/08/04 → Maintenance Plan / Work Order / Execution / Log.
- BM-TBSX-05 → Equipment Handover + release guard.
- BM-TBSX-06 → Downtime event + MTBF/MTTR/downtime rate.
- BM-TBSX-09/10/11 → Tooling Master / Plan / Change Control.
- Calibration source 2024 → Calibration Master / Log / historical vendor quotation & summary.

## 2. Workflow transition

Implemented and tested:

`OPEN → WAITING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED → VERIFIED → BM-05 ACCEPTED → RELEASED`

Daily inspection `X` creates the business intent for equipment DOWN + Work Order + Downtime Event.

## 3. KPI contract

BM-TBSX-06 formulas are implemented as pure functions:

- MTBF = (runtime − downtime) / failure count.
- MTTR = downtime / failure count.
- Downtime rate = downtime / runtime.
- Target = ≤ 8%.

Zero-failure cases return null for MTBF/MTTR instead of NaN/Infinity.

## 4. Governance / audit

- Requester cannot approve the same Work Order.
- Maintenance performer cannot self-verify the test run.
- Release requires accepted BM-TBSX-05 and operable condition.
- Workflow changes append Audit_Log events with actor/action/entity/before/after.

## 5. Frozen persistence contract

`src/domain/persistenceContract.ts` is the authoritative storage contract.
`CORE_SHEET_NAMES` is retained only as a compatibility alias to `PERSISTENCE_TABLES`; there is no second independent list.

Structured data contains 20 tables, including:

- Calibration_Master / Calibration_Log.
- Calibration_Vendor_Quote / Calibration_Quote_Summary.
- Equipment_Handover.
- Downtime_Event.
- Audit_Log.

File/document evidence is separated into 9 evidence folders for Drive-like storage.

Calibration financial data from `source/` is retained as historical quotation evidence and structured comparison data; it is not labeled as current/live vendor pricing.

## G1 verification

- [x] Legacy `CORE_SHEET_NAMES` reconciled with authoritative `PERSISTENCE_TABLES`.
- [x] Workflow/state/KPI/governance/handover/audit tests implemented.
- [x] Quality Gate passed Test + Build + Lint on the final candidate before freeze.
- [x] Vercel Preview deployment succeeded on the final candidate before freeze.

## Phase 3 entry

Gate G1 is frozen. The next implementation phase may connect Google Sheets for the 20 structured tables and Google Drive for the 9 evidence folders. Credentials must remain backend-only; the frontend must never store Google credentials.
