# Equipment UI architecture

Equipment follows the same principle used by the reference apps: one shared business model, separate platform renderers.

## Runtime entry point

`EquipmentWorkspace.tsx` selects exactly one presentation tree:

- `< 901px` → `mobile/EquipmentMobileWorkspace.tsx`
- `>= 901px` → `desktop/EquipmentDesktopWorkspace.tsx`

Desktop must never import mobile UI/CSS. Mobile must never import desktop UI/CSS.

## Shared business layer

`shared/useEquipmentPanelController.ts` owns the reusable equipment behavior:

- Supabase/cache loading and revalidation
- filter/sort/visible-column state
- edit/delete/save mutations
- bulk edit state and save
- photo load/upload/delete/paste
- equipment profile/edit selection
- permissions and criticality derivation
- canonical column definitions and value helpers

Do not duplicate these rules in desktop/mobile renderers.

Shared field/control components are also allowed when the business model must remain identical, for example registration/edit fields, autocomplete, status semantics and the immutable equipment-image contract.

## Desktop ownership

`desktop/EquipmentDesktopPanel.tsx` owns desktop DOM/composition.

Desktop presentation files:

- `desktop/EquipmentDesktop.css`
- `desktop/EquipmentDesktopSheet.css`

Desktop may use table density, hover preview, desktop filter placement and desktop drawer geometry. Do not add mobile placement rules here.

## Mobile ownership

`mobile/EquipmentMobilePanel.tsx` owns mobile/tablet DOM/composition.

Mobile presentation files:

- `mobile/EquipmentMobile.css`
- `mobile/EquipmentMobileSheet.css`
- `mobile/EquipmentMobileForms.css`

Mobile owns its title, summary, 3-column quick actions, search/tools, full-width list/table viewport, touch targets, bottom-nav safe area and mobile drawer geometry. Do not repair mobile by overriding desktop DOM.

Registration is a shared business component but its drawer is portaled to `document.body`; therefore mobile-only portal placement rules may be unscoped inside `EquipmentMobileForms.css`. That stylesheet is loaded only from the mobile workspace.

## Shared CSS boundary

Root Equipment CSS files may contain component primitives only: control appearance, status badges, image-fit contract, generic table-cell semantics and reusable edit-field visuals.

Viewport/page composition, spacing, widths, positioning and breakpoint behavior belong under `src/equipment/desktop` or `src/equipment/mobile`.

## Breakpoint contract

- Mobile/tablet renderer: `< 901px`
- Desktop renderer: `>= 901px`

There is no undefined 641–900px ownership range.

## Regression rule

Do not recreate a mixed `LiveEquipmentPanel` that renders one DOM tree and relies on desktop/mobile CSS overrides. If desktop and mobile need different UX, create/change the corresponding renderer while keeping business rules in the shared controller.

Required verification remains 375, 440, 768, 1024 and 1440 px per `AGENTS.md` and `docs/UI_UX_REFERENCE.md`.
