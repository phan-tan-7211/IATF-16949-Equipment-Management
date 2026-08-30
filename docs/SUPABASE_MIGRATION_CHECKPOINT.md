# Supabase Migration Checkpoint

## Current architecture

```text
Vercel React + Vite + TypeScript
        ↓
Supabase
├─ PostgreSQL
├─ Auth / app_user_role
├─ RLS
├─ private Storage
└─ RPC / transactional workflow
```

The migration target is Supabase-only. Cloudflare R2 is not used. Apps Script, Google Sheets and Google Drive are historical runtime components and are not part of this branch's active runtime.

## Branch policy

- `main` remains the rollback/production baseline until explicit cutover approval.
- `feat/supabase-r2-migration` is the historical branch name; its current architecture is Supabase-only.
- Do not cut over production without the gates in `MASTER_IMPLEMENTATION_PLAN.md`.

## Canonical identity

```text
ONE EQUIPMENT → ONE EQUIPMENT ID → ONE ROOT RECORD → ALL BUSINESS RECORDS REFERENCE THE SAME ID
```

Internal canonical ID convention:

```text
PRODUCTION  → CEV-PR-NNN
MEASUREMENT → CEV-ME-NNN
```

Legacy/control numbers remain traceability metadata and must not replace canonical `equipment_id`.

## G1 contract

Frozen contract: `G1-frozen-2026-08-28`.

The 20-table business contract remains authoritative across Equipment, Inspection, Maintenance, Handover, Downtime, Tooling, Calibration, Movement and Audit.

## Supabase authority

- browser uses only the public Supabase client key;
- RLS protects direct table access;
- protected multi-table mutations run through RPC;
- privileged keys must never be committed to Vite/GitHub client code;
- private Storage keeps evidence objects; DB stores object paths/metadata.

## Current verification checkpoint

Completed verification includes:

- DB read/auth/session/RLS;
- Equipment Master update RPC;
- Daily Inspection transaction, including `STOP_REPAIR`;
- Maintenance workflow and BM-05 release gate;
- Tooling create/plan/modification workflow;
- Calibration Log + Calibration Master + Audit transaction;
- ADMIN Audit visibility;
- negative role tests;
- Quality Gate test/build/lint.

## Remaining production gate

Before replacing `main` runtime:

1. Vercel preview/build with Supabase env.
2. Browser smoke test by role.
3. Storage upload/read verification for equipment photos and calibration certificates.
4. Full workflow browser smoke tests.
5. Data-count/canonical-ID reconciliation.
6. Backup and rollback checkpoint.
7. Explicit production cutover approval.
