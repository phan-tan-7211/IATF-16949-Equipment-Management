# Gate G1 — Schema Freeze Checklist

Status: **CANDIDATE — chưa mở Google persistence**

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

## 5. Persistence contract candidate

Structured tables are defined in `src/domain/persistenceContract.ts`.
Evidence folders are defined separately for Drive-like binary/document storage.

Calibration financial data from `source/` is retained as historical quotation evidence and structured comparison data; it is not labeled as current/live vendor pricing.

## Remaining before G1 is declared frozen

1. Reconcile legacy `CORE_SHEET_NAMES` in `models.ts` with the new authoritative `PERSISTENCE_TABLES` list.
2. Confirm Quality Gate passes Test + Build + Lint on the final candidate commit.
3. Confirm Vercel Preview deployment succeeds.

Only after all three are green should Google Sheets/Drive integration begin.
