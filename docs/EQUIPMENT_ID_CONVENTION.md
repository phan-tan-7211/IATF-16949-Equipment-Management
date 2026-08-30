# Equipment ID Convention

Status: active for `feat/supabase-r2-migration`.

## Purpose

This convention supports the frozen G1 rule that one physical equipment item has one canonical `equipment_id`, and all inspection, maintenance, calibration, downtime, movement, handover and audit records reference that same ID.

IATF 16949 requires equipment/measurement resources to be identifiable and traceable through controlled records, but it does not prescribe a literal string format. The format below is therefore the project's internal control rule.

## Canonical IDs

- Production equipment: `CEV-PR-NNN`
- Measurement / test equipment: `CEV-ME-NNN`
- `NNN` is a zero-padded sequential number within that equipment class.

Examples:

- `CEV-PR-001`
- `CEV-ME-053`

## Rules

1. `equipment_id` is the canonical identity and must be unique.
2. Supplier serial number, legacy machine number, old CEV code or source spreadsheet code must not automatically become the canonical ID.
3. Legacy/source identifiers are preserved in `control_number` and/or `source_data`.
4. Serial number is stored in `serial_number`; model is stored in `model`.
5. Once an equipment ID is referenced by business history, do not recycle the ID for another physical asset.
6. If an imported source row clearly matches an existing canonical asset by strong identity evidence (serial/model), enrich the existing record instead of creating a duplicate.
7. If a source row lacks enough information to identify a physical asset (for example only a location with no name/model/code), do not invent an asset record; flag it for source cleanup.
8. `qr_code` follows the canonical `equipment_id` in the current G1 contract.

## 2026-08-29 equipment-register import

The user-supplied equipment register contained 85 source rows. Import handling:

- 68 new production assets: `CEV-PR-001` through `CEV-PR-068`.
- 11 new measurement assets: `CEV-ME-053` through `CEV-ME-063`.
- 5 source rows were matched to existing measurement assets and enriched rather than duplicated.
- 1 source row containing only `Coil line D` without a usable equipment identity was not converted into a fabricated asset.

Original source values are preserved in `source_data` / `control_number` for traceability.
