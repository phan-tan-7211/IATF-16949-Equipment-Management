# Phase 3 Production Deployment Runbook

## Frozen architecture

```text
User
  ↓
Vercel Frontend (React + Vite + TypeScript)
  ↓
Apps Script Backend
  ↓
Google Sheets / Google Drive
```

`AppShell` is backend diagnostic/test UI only. It is never the production frontend.

## Canonical production frontend

Use this origin as the production parent origin:

```text
https://iatf-16949-equipment-management.vercel.app
```

Do not treat deployment-hash aliases as canonical production origins.

## Deployment order

1. Merge a CI-green Phase 3 branch only after backend + frontend smoke is ready.
2. Update the Apps Script project files from `apps-script/`.
3. Confirm Script Properties before web-app deployment:
   - `RBAC_JSON`: authoritative email → role mapping.
   - `ALLOWED_PARENT_ORIGINS_JSON`: must contain the canonical Vercel origin above. Temporary preview origins may be added only for controlled preview testing.
4. Deploy a new Apps Script web-app version using the same production web-app deployment when possible, so the `/exec` URL remains stable.
5. Verify `?action=health` returns contract version `G1-frozen-2026-08-28`.
6. Verify the bridge page loads with `?action=bridge` while authenticated with an authorized Google account.
7. Deploy the Vercel frontend.
8. Run the production smoke checklist below.

## Required Apps Script files for Phase 3

The deployment must include at least the current versions of:

- `Code.gs`
- `Bridge.html`
- `BridgeRouter.gs`
- `Session.gs`
- `DailyInspection.gs`
- `Maintenance.gs`
- `Tooling.gs`
- `Calibration.gs`
- all existing persistence / evidence / audit helpers referenced by those modules
- `appsscript.json`

Do not deploy only `BridgeRouter.gs`; Apps Script deployment must use a consistent source set.

## Security checks

- Browser never receives Google credentials.
- Browser never writes Google Sheets/Drive directly.
- Actor email comes from `Session.getActiveUser().getEmail()`.
- Role comes from backend `RBAC_JSON`.
- Contract version is checked on bridge requests.
- Bridge only accepts explicitly allowed parent origins.
- `Audit_Log` reads through the production bridge are ADMIN-only.
- Workflow transitions remain backend-authoritative.

## Frontend production smoke

### Session

- Header shows `BACKEND LIVE`.
- `Audit & Cấu hình` displays authenticated backend email + role.
- No `supervisor-demo`, mock role or local workflow identity is shown.

### Equipment

Expected current production counts:

```text
Total        71
PRODUCTION   19
MEASUREMENT  52
```

### Calibration

Expected current production state:

```text
Calibration_Master  52
LINKED              52
UNLINKED             0
ORPHAN               0
INVALID_TYPE         0
```

Do not create 52 Calibration_Log PASS transactions automatically.

### Daily Inspection

- Equipment selector is loaded from live Equipment_Master.
- Saving mark `V` creates a Daily_Inspection transaction.
- Mark `STOP_REPAIR` requires reason/priority and backend creates Work Order + Downtime according to business rules.

### Maintenance

- Work Orders are loaded from production data.
- Workflow follows:
  `OPEN → WAITING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED → VERIFIED → RELEASED`.
- Self approval / self verification backend guards remain effective.
- RELEASE requires accepted BM-05 handover and operable condition.

### Tooling

- Tooling Master / Maintenance Plan / Modification are live.
- Modification approval, QA confirmation and completion use backend actions.

### Audit

- Non-ADMIN user cannot read Audit_Log.
- ADMIN can view the latest Audit_Log events.

## Failure policy

Never fall back silently to mock production data when backend loading fails. Show a loading/error/empty state instead.

Do not merge or promote a deployment if Equipment / Calibration live counts do not match the expected production state above unless production data was intentionally changed and verified.
