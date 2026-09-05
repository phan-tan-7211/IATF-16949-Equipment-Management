---
name: ui-ux-pro-max
description: Project-local UI/UX review rules for CEV Equipment Management, derived from nextlevelbuilder/ui-ux-pro-max-skill and adapted to this React/Vite mobile-first CMMS.
---

# UI/UX Pro Max — CEV Project Rules

Upstream reference: `nextlevelbuilder/ui-ux-pro-max-skill` (source commit family reviewed 2026-09-04).
Visual inspiration reference: `KKshitiz/Awesome-UI-Templates`.
Product references: MaintainX, Limble, UpKeep.
Architecture companion: `.agents/skills/platform-ui-architecture/SKILL.md`.

Use this skill for every UI, responsive, mobile, navigation, drawer, form, card, profile, work-order, inspection, spare-part, QR, or dashboard change.
For desktop/mobile renderer or layout ownership changes, read the platform architecture skill before implementation as well.

## Priority order

1. Accessibility
2. Touch and interaction
3. Navigation continuity
4. Responsive layout
5. Forms and feedback
6. Visual consistency
7. Performance

## Non-negotiable CEV rules

### 1. Navigation continuity
- Every drill-down action must have a predictable way back to the exact source context.
- If a user goes `Equipment Profile -> Maintenance / Inspection / Spare / QR`, the destination must expose `← Trở về <equipment_id>`.
- Bottom navigation is global navigation and must not replace contextual Back.
- Maximum 5 persistent bottom-nav items.
- Direct navigation from global nav clears stale contextual Back state.

### 2. Responsive behavior must preserve capability
- Breakpoints may rearrange layout, never remove required actions.
- Desktop, tablet and mobile must expose the same business actions unless permission rules differ.
- Required test widths: 375, 440, 768, 1024, 1440 px.
- No horizontal page scrolling.
- Text, chips, badges and buttons must reflow without clipping.
- Never solve overflow by hiding a required action.
- If desktop and mobile need materially different DOM/task flow, use separate platform renderers with shared business logic; do not keep adding CSS patches to one mixed renderer.

### 3. One scroll owner
- Modal/drawer/profile overlays must lock the background.
- Only the foreground content area scrolls.
- Header/footer actions remain reachable.
- Use `100dvh` and safe-area handling on mobile where appropriate.
- Avoid scroll chaining from drawer to page behind it.

### 4. No duplicate information on one screen
- Identity information belongs in the hero/header once.
- Do not repeat Equipment ID, Criticality, Status, or the same field again in Overview.
- Summary cards should add new information, not mirror hero data.

### 5. Touch targets
- Primary touch targets should be at least 44x44 px.
- Keep enough separation between destructive and primary actions.
- Do not rely on hover for discovery.
- Every icon-only control requires an accessible label.

### 6. Footer actions
- Destructive, cancel and save actions must remain visible/reachable at all supported widths.
- Responsive CSS may change wrapping or alignment but must not change action existence.
- Delete must never disappear because of viewport width.

### 7. Forms
- Registration and Edit for the same entity must share the same business field model.
- If a field can be created, it must be editable later unless it is explicitly system-managed.
- System-managed Equipment ID / QR / type-derived prefix remain read-only.
- Labels stay visible; placeholder is not a label.
- Validation appears near the affected action/field and must not wipe user input.

### 8. Status and badges
- Meaning must not rely on color alone.
- Always include text such as `RUNNING`, `Cấp A`, etc.
- Unknown/missing values should display an intentional state, not broken layout.

### 9. Mobile-first task flow
- One screen = one primary task.
- Prefer short cards, quick actions, full-screen drawers and bottom sheets.
- Avoid desktop tables on mobile when a card/list interaction is materially better; if the DOM differs, own it in the mobile renderer instead of overriding desktop markup.
- Sticky CTA is allowed when it does not cover content or bottom navigation.

### 10. Equipment image contract — immutable
Applies to Equipment Profile, Equipment List thumbnails, Edit Equipment, Register Equipment, QR/profile previews and all future equipment-image UI.

- Always show the complete source bitmap.
- Never crop, clip, mask, zoom-crop or hide corners/edges.
- Small images must scale UP to use the available frame.
- Large images must scale DOWN to fit the available frame.
- Preserve original aspect ratio at all times; never stretch or squash.
- Keep the image centered.
- Use `object-fit: contain` behavior, never `cover`, for equipment images.
- Preferred implementation: stable frame + image `width:100%; height:100%; object-fit:contain; object-position:center`.
- Breakpoints may resize/reflow the frame only; they must never change fit behavior.
- Equipment List thumbnails must share one fixed frame size so source dimensions never alter row/card layout.
- Do not replace this with natural-size-only rendering (`width:auto;height:auto`) because small source images must also upscale to the frame.
- Do not add CSS overrides that revert any equipment image to `cover`.
- Before delivery test five image shapes/sizes: small, large, portrait, landscape, square.

### 11. Architecture ownership
- Shared primitives own accessibility/interaction contracts, not page composition.
- UI primitives must not call Supabase directly.
- Equipment desktop code must not import mobile renderers; mobile code must not import desktop renderers.
- Shared Equipment controller/hooks must not import either platform renderer.
- `EquipmentWorkspace.tsx` is the single platform selector for Equipment.
- Current Equipment boundary: `<901px` mobile/tablet, `>=901px` desktop.
- Run `npm run test:architecture` after platform/refactor work.

### 12. Pre-delivery UI checklist
Before claiming a UI change is done, verify:
- [ ] 375 px
- [ ] 440 px
- [ ] 768 px
- [ ] 1024 px
- [ ] 1440 px
- [ ] required actions never disappear
- [ ] contextual Back works
- [ ] no duplicate information on same screen
- [ ] no background scroll behind drawer/modal
- [ ] footer actions reachable
- [ ] no horizontal page scroll
- [ ] keyboard focus visible
- [ ] touch targets usable
- [ ] badge meaning not color-only
- [ ] safe-area does not hide CTA/nav
- [ ] equipment images show full bitmap, upscale/downscale, never crop or distort
- [ ] architecture guard passes when platform layout changed
- [ ] Chromium + Pixel/WebKit smoke gates remain green

## Project-specific mobile architecture

Primary bottom navigation:
- Home
- Work
- Scan
- Equipment
- More

Equipment Profile quick actions:
- Maintenance
- Inspection
- Spare
- QR

Each quick action must preserve `equipment_id` as navigation context so the user can return to the exact equipment profile.

## Source usage

Use `nextlevelbuilder/ui-ux-pro-max-skill` for UX rules and anti-patterns.
Use `.agents/skills/platform-ui-architecture/SKILL.md` for desktop/mobile ownership and shared-layer boundaries.
Use `KKshitiz/Awesome-UI-Templates` only for visual inspiration, never as a source of business workflow logic.
Use MaintainX/Limble/UpKeep only as CMMS interaction references; CEV workflow and current repository architecture take precedence.
