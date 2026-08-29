# Original Plan Completeness Matrix

Purpose: prevent feature drift between `SOURCE_FIRST_IMPLEMENTATION_PLAN.md` and the Supabase cutover implementation.

| Original requirement | Current status | Cutover requirement |
| --- | --- | --- |
| Equipment list/profile | DONE | browser smoke |
| QR entry point | IMPLEMENTED / DEVICE TEST | Android + iPhone real-camera smoke |
| Daily inspection form | DONE | browser smoke |
| Maintenance Plan | IMPLEMENTED / BROWSER TEST | verify BM03 create/edit + Item/Standard/Method UX |
| Maintenance Work Order | DONE | browser smoke |
| Maintenance Execution / Result | IMPLEMENTED / BROWSER TEST | verify BM08 ○/△/× + abnormal-action UX |
| Equipment Handover | IMPLEMENTED / BROWSER TEST | verify BM05 form + accepted release gate UX |
| Downtime / KPI | PARTIAL REVIEW | verify BM06 report coverage |
| Tooling Master / Change | DONE CORE | browser smoke |
| Calibration Master / Due | DONE CORE | browser smoke |
| Calibration Vendor Quote History | MISSING/REVIEW | must reconcile with source requirement |
| Auth / RBAC | DONE CORE | non-ADMIN real-user smoke |
| Immutable/server audit | DONE CORE | ADMIN browser smoke |
| A4/PDF renderer | MISSING | required before declaring original plan complete |
| Export audit package | MISSING | required before declaring original plan complete |

## BM03 implementation contract

BM-TBSX-03 now persists through `rpc_upsert_maintenance_plan()` into `maintenance_plan` + `maintenance_plan_item` atomically and writes Audit in the same transaction.

- Production Equipment only.
- Maintenance type PM / PdM / CM.
- Frequency, planned date/window, responsible person and note.
- Multiple detailed `Item / Standard / Method` rows.
- Create/edit uses replace-items transaction semantics so header and detail rows cannot drift.
- Backend rollback smoke verified plan + 2 items + audit and left zero test records.

## BM08 implementation contract

BM-TBSX-08 now persists through `rpc_record_maintenance_result()` into `maintenance_execution` + `maintenance_result_item`, plus Maintenance Log + Audit in one transaction.

- Linked to an IN_PROGRESS/COMPLETED Work Order.
- Execution date, periodic frequency and inspection department.
- Item rows are prefilled from active BM03 where available.
- Result marks: `○` good, `△` warning, `×` repair.
- `△/×` requires repair or maintenance action content at backend authority.
- Each row records repair content, maintenance content and inspector.
- Backend rollback smoke verified Execution + 2 Result Items + Log + Audit and left zero test records.

## BM05 implementation contract

BM-TBSX-05 now persists through `rpc_record_equipment_handover()` into `equipment_handover` + Audit in one transaction.

- Supports a standalone equipment handover or a handover tied to a Work Order.
- A Work Order-linked handover is accepted only after the Work Order is `VERIFIED`.
- Captures handover time/location, chair department, meeting content and participants.
- Captures handover/receiver person, title and department.
- Captures handover reason and condition (`NORMAL`, `MINOR_ISSUE`, `NOT_OPERATIONAL`).
- Captures attached documents/accessories, both-party comments and other agreements.
- Receiver acceptance is recorded explicitly; only `accepted=true` satisfies the existing RELEASE gate.
- Backend rollback smoke verified VERIFIED → accepted BM05 → RELEASED and left zero test records.

## QR implementation contract

QR is a first-class mobile entry point, not a post-cutover extra.

- One tap from mobile bottom navigation.
- Rear camera preferred.
- Continuous scan, no shutter button.
- Up to 25 scan attempts/second, bounded by camera/browser frame rate.
- Native `BarcodeDetector` used by scanner engine when available.
- Worker fallback for browsers without native detection (notably iPhone/Safari).
- Center scan region is downscaled by scanner engine for faster decoding.
- Equipment IDs are validated against active `equipment_master` index before opening.
- Supports raw canonical ID (`CEV-PR-001`) and QR URLs containing `equipment=CEV-PR-001`.
- Successful scan stops camera, vibrates briefly, and opens Equipment 360 profile without full-page reload.
- Flash toggle shown when the rear camera/browser supports it.
- Manual Equipment ID entry remains as permission/camera fallback.

## Rule

No future statement that the original plan is "complete" may be made while this matrix contains `MISSING`, `PARTIAL REVIEW`, `BROWSER TEST`, or `DEVICE TEST` items.
