# Original Plan Completeness Matrix

Purpose: prevent feature drift between `SOURCE_FIRST_IMPLEMENTATION_PLAN.md` and the Supabase cutover implementation.

| Original requirement | Current status | Cutover requirement |
| --- | --- | --- |
| Equipment list/profile | DONE | browser smoke |
| QR entry point | IMPLEMENTED / DEVICE TEST | Android + iPhone real-camera smoke |
| Daily inspection form | DONE | browser smoke |
| Maintenance Plan | PARTIAL REVIEW | verify BM03 UI coverage |
| Maintenance Work Order | DONE | browser smoke |
| Maintenance Execution / Result | PARTIAL REVIEW | verify BM08 coverage |
| Equipment Handover | PARTIAL REVIEW | BM05 release gate exists; verify dedicated UX/evidence |
| Downtime / KPI | PARTIAL REVIEW | verify BM06 report coverage |
| Tooling Master / Change | DONE CORE | browser smoke |
| Calibration Master / Due | DONE CORE | browser smoke |
| Calibration Vendor Quote History | MISSING/REVIEW | must reconcile with source requirement |
| Auth / RBAC | DONE CORE | non-ADMIN real-user smoke |
| Immutable/server audit | DONE CORE | ADMIN browser smoke |
| A4/PDF renderer | MISSING | required before declaring original plan complete |
| Export audit package | MISSING | required before declaring original plan complete |

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

No future statement that the original plan is "complete" may be made while this matrix contains `MISSING`, `PARTIAL REVIEW`, or `DEVICE TEST` items.
