# Frontend platform architecture

## Goal

Keep one business system while allowing desktop and mobile/tablet to have genuinely different presentation structures where the workflow requires it.

The required dependency direction is:

```text
data / repositories / services
        ↓
shared feature controller / hooks / types
        ↓
┌───────────────────────┬────────────────────────┐
│ desktop presentation  │ mobile/tablet presentation │
└───────────────────────┴────────────────────────┘
        ↓                         ↓
 desktop CSS owner          mobile CSS owner
```

## Reference principles

The project adopts architecture ideas, not source code, from these public projects:

- Cal.com: feature/business boundaries stay independent from presentation framework details where possible.
- create-t3-turbo: apps/platforms may differ while packages/shared services remain single-source.
- Dify: UI primitives should not own business API/state concerns.
- shadcn/ui: accessible primitives are composed into features rather than every feature inventing its own controls.
- Solito and Tamagui: cross-platform code sharing should preserve platform-specific rendering where UX differs.

CEV project requirements always take precedence.

## Equipment structure

```text
src/equipment/
├─ EquipmentWorkspace.tsx          # platform selector only
├─ shared/                         # controller, state, types, feature behavior
├─ desktop/                        # desktop renderer + desktop layout CSS
└─ mobile/                         # mobile/tablet renderer + mobile layout CSS
```

Current platform contract:

- mobile/tablet: `< 901px`
- desktop: `>= 901px`

Only `EquipmentWorkspace.tsx` decides which platform presentation renders.

## Ownership rules

### Shared

Allowed:
- Supabase-facing orchestration through existing data/service modules;
- filters, sorting, cache orchestration, mutation state;
- permission checks;
- criticality calculation;
- photo actions;
- reusable field/control behavior;
- types and constants.

Forbidden:
- desktop page composition;
- mobile page composition;
- imports from `desktop/**` or `mobile/**`;
- platform-specific navigation layout.

### Desktop

Owns:
- desktop Equipment page hierarchy;
- desktop table behavior and placement;
- desktop toolbar/action placement;
- desktop drawer dimensions and hover-only presentation.

Must not import mobile presentation.

### Mobile/tablet

Owns:
- mobile/tablet page hierarchy;
- compact action layout;
- mobile table/card/list choice;
- safe-area and bottom-navigation spacing;
- mobile drawer/full-screen placement.

Must not import desktop presentation.

## Shared primitives

Shared primitives are allowed when their meaning and interaction contract are the same across platforms, for example:

- input;
- button;
- autocomplete;
- status badge;
- equipment image frame;
- field label;
- validation message.

A primitive must not call Supabase directly. It receives values/callbacks from a feature/controller layer.

## Anti-patterns

Do not:

- bring back a single mixed `LiveEquipmentPanel.tsx` for both platforms;
- copy Supabase mutations into desktop and mobile separately;
- duplicate validation/criticality/business rules;
- add long chains of `!important` so mobile can undo desktop assumptions;
- place mobile layout media queries into desktop layout files;
- place desktop layout media queries into mobile layout files;
- hide required Save/Delete/Cancel actions to make a breakpoint fit.

## Decision rule

If the difference is only spacing, font size or a small alignment change, share the primitive.

If the DOM/task flow differs materially—table vs card, toolbar location, navigation, overlay mechanics, safe-area behavior—use a platform renderer.

## Required checks

Architecture changes are not complete until:

```bash
npm run test:architecture
npm test
npm run lint
npm run build
```

UI must then be checked locally at 375, 440, 768, 1024 and 1440 px.

These are local development gates for the current project workflow. Do not use deployment visibility as proof that the UI or architecture works locally.
