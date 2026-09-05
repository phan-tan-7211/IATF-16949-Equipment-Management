---
name: platform-ui-architecture
description: Mandatory CEV frontend architecture rules for separating desktop/mobile presentation while sharing domain, data, services and UI primitives.
---

# Platform UI Architecture — CEV

Use this skill before changing Equipment layout, responsive behavior, navigation, forms, drawers, tables, cards, or shared UI infrastructure.

Reference principles adapted for this repository from Cal.com, create-t3-turbo, Dify, shadcn/ui, Solito and Tamagui. Do not copy their source code blindly; preserve CEV business rules and this repository's stack.

## Core model

`domain/data/services -> shared controller/hooks -> platform renderer -> platform CSS`

The application shares business logic. It does not share page composition when desktop and mobile UX differ materially.

## Mandatory boundaries

1. `src/equipment/shared/**`
   - May contain domain-facing hooks/controllers, state orchestration, types, configuration and reusable behavior.
   - Must not import from `desktop/**` or `mobile/**`.
   - Must not contain desktop/mobile page composition.

2. `src/equipment/desktop/**`
   - Owns desktop Equipment DOM hierarchy and desktop-only layout CSS.
   - Must not import from `mobile/**`.
   - Desktop behavior starts at the project platform boundary `>= 901px`.

3. `src/equipment/mobile/**`
   - Owns mobile/tablet Equipment DOM hierarchy and mobile-only layout CSS.
   - Must not import from `desktop/**`.
   - Mobile/tablet behavior is `< 901px`.

4. Shared primitives
   - Reusable controls such as buttons, inputs, autocomplete, badges, image frames and field components may be shared.
   - Shared primitives must not decide platform page layout.
   - Shared visual primitives must not contain viewport-specific page composition media queries.

5. Data/business ownership
   - Supabase access belongs in data/repository/service layers, not presentational primitives.
   - Permissions, validation, equipment IDs, criticality rules, save/delete/upload logic and cache behavior have one source of truth.
   - Never fork business rules into separate desktop and mobile implementations.

6. Registration/Edit parity
   - Desktop and mobile may render different layouts.
   - Both use the same field model, validation rules and mutations.
   - A field created on one platform must remain editable on the other unless explicitly system-managed.

## UI primitive rule

Follow the shadcn/Dify-style boundary:

- primitive = presentation + accessibility + interaction contract
- feature = equipment-specific behavior
- repository/service = Supabase/network/storage

A primitive component must not call Supabase directly or import feature state from a platform renderer.

## When to split a renderer

Split desktop/mobile presentation when one or more are true:
- table vs card/list interaction differs materially;
- navigation pattern differs;
- toolbar/action placement differs materially;
- overlay/drawer behavior differs;
- mobile requires full-width/safe-area behavior that would otherwise require many overrides;
- maintaining one DOM requires `!important` chains or repeated breakpoint patches.

Do not split simple controls merely because padding/font size changes.

## CSS rules

- Desktop page layout lives under `src/equipment/desktop/*.css`.
- Mobile/tablet page layout lives under `src/equipment/mobile/*.css`.
- Shared CSS is primitive-only.
- Do not use mobile CSS to undo desktop DOM assumptions.
- Do not use desktop CSS to repair mobile overflow.
- Avoid `!important`; if repeated `!important` is required, first check whether the renderer belongs in the wrong platform layer.
- Required actions must remain reachable at all supported widths.

## Architecture verification

Before declaring Equipment architecture work complete:
- run `npm run test:architecture`;
- run normal test/build/lint locally;
- verify 375, 440, 768, 1024 and 1440 px;
- verify desktop imports no mobile implementation;
- verify mobile imports no desktop implementation;
- verify shared imports neither platform;
- verify no legacy mixed `LiveEquipmentPanel.tsx` returns.

## Reference hierarchy

For architecture decisions prefer:
1. CEV `AGENTS.md` and project docs.
2. This skill.
3. Cal.com / create-t3-turbo principles for feature/platform boundaries.
4. Dify / shadcn principles for primitive-vs-business separation.
5. Solito / Tamagui principles for sharing logic while allowing platform-specific rendering.

When a reference conflicts with CEV business requirements, CEV requirements win.
