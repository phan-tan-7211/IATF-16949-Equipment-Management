# Mandatory architecture and release gates

React + Vite + TypeScript on Vercel → Supabase PostgreSQL, Auth/RLS, Storage and RPC.
Apps Script, Google Sheets and Google Drive are not runtime dependencies.

One equipment → one canonical equipment_id → one equipment_master root record.
Production IDs: CEV-PR-NNN. Measurement IDs: CEV-ME-NNN.
Every workflow references the same ID. Never create parallel equipment identities.

Business writes use authorized RPC/RLS boundaries. Never expose service-role credentials in frontend code.
A4/PDF renders existing Supabase records; do not introduce separate form data storage.
Audit ZIP export requires ADMIN. Record export limitations and checksum verification instructions.

Work on feat/final-cutover-gates / PR #4, not directly on main.
Before merge: tests, build, lint, Chromium/Pixel 7/WebKit automated smoke,
Supabase diagnostics, confirmed Vercel project/deployment visibility, production smoke,
and final DB/Storage reconciliation must pass.
Android and iPhone camera scans are separate physical-device gates. Browser emulation
cannot satisfy them. Do not merge while any required gate is failing or unverified.
