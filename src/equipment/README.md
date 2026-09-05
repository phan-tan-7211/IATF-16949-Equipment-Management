# Equipment UI architecture

Equipment presentation is split by viewport. Do not put responsive page layout back into one mixed stylesheet.

## Entry point

- `EquipmentWorkspace.tsx` selects exactly one presentation entrypoint at runtime.
- `desktop/EquipmentDesktopWorkspace.tsx` owns desktop composition.
- `mobile/EquipmentMobileWorkspace.tsx` owns mobile composition.

## Layout ownership

- Desktop-only layout: `desktop/EquipmentDesktop.css`
- Mobile-only layout: `mobile/EquipmentMobile.css`

Do not add mobile page-layout rules to the desktop file and do not add desktop page-layout rules to the mobile file.

## What may stay shared

Business/data logic and reusable field/control behavior may remain shared, including Supabase repositories, equipment mutations, autocomplete data, image upload logic, validation, permissions and field components. Shared styles must be component primitives only; viewport page composition belongs in the desktop/mobile files above.

## Breakpoint contract

- Mobile: `< 901px`
- Desktop: `>= 901px`

Required UI verification remains 375, 440, 768, 1024 and 1440 px per `AGENTS.md` and `docs/UI_UX_REFERENCE.md`.
