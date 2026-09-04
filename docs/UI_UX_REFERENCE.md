# CEV UI/UX Reference

This document is the project-level UI/UX reference for Equipment Management.

## Primary rule source

- `nextlevelbuilder/ui-ux-pro-max-skill`
  - Use for accessibility, touch targets, responsive layout, navigation continuity, forms, feedback, text reflow, badges, safe-area and pre-delivery checks.

## Visual inspiration

- `KKshitiz/Awesome-UI-Templates`
  - Use only for visual/pattern inspiration.
  - Do not copy unrelated layouts or business logic.

## CMMS interaction references

- MaintainX: technician/mobile-first task execution, procedure/checklist patterns.
- Limble: PM planning, asset history, reliability/dashboard relationships.
- UpKeep: request -> work order -> execution -> asset history, QR/requester patterns.

CEV workflow and current repository data model always take precedence over these products.

## CEV responsive rules

1. Breakpoints change arrangement, never business capability.
2. Required actions cannot disappear on smaller widths.
3. Contextual drill-down must provide a Back action to the exact source entity.
4. Bottom nav is global navigation, not contextual Back.
5. One overlay = one scroll owner; background stays locked.
6. Do not duplicate the same data twice on one screen.
7. Registration/Edit for the same entity share the same business fields.
8. Mobile tables become cards or label-value rows.
9. Destructive/Cancel/Save actions remain reachable at all supported widths.
10. Safe-area must be respected for sticky actions and bottom navigation.

## Required viewport checks

- 375 px
- 440 px
- 768 px
- 1024 px
- 1440 px

## Mobile Equipment Profile rule

Hero contains only identity and quick recognition:
- Equipment ID
- Equipment name
- Photo
- Status
- Criticality
- Non-duplicated key metadata

Quick actions:
- Maintenance
- Inspection
- Spare
- QR

If one of those actions opens another workspace, show:

`← Trở về <equipment_id>`

and return to the same Equipment Profile.

## UI review checklist

- [ ] No action disappears by viewport width
- [ ] No background scroll behind open drawer/modal
- [ ] Header/footer actions stay reachable
- [ ] No duplicate Equipment ID / Status / Criticality on same screen
- [ ] Contextual Back works after quick actions
- [ ] No page-level horizontal scroll
- [ ] 44x44-ish touch targets for primary mobile controls
- [ ] Visible labels on form fields
- [ ] Badge/status meaning is not color-only
- [ ] Text and chips reflow without clipping
- [ ] Safe-area tested
- [ ] Tests/build/lint/browser smoke pass
