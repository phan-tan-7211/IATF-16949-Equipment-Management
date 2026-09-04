# Mandatory architecture and release gates

React + Vite + TypeScript on Vercel → Supabase PostgreSQL, Auth/RLS, Storage and RPC.
Apps Script, Google Sheets and Google Drive are not runtime dependencies.

One equipment → one canonical equipment_id → one equipment_master root record.
Production IDs: CEV-PR-NNN. Measurement IDs: CEV-ME-NNN.
Every workflow references the same ID. Never create parallel equipment identities.

Business writes use authorized RPC/RLS boundaries. Never expose service-role credentials in frontend code.
A4/PDF renders existing Supabase records; do not introduce separate form data storage.
Audit ZIP export requires ADMIN. Record export limitations and checksum verification instructions.

## Mandatory UI/UX gate

For every UI, responsive, mobile, navigation, form, drawer, modal, profile, work-order, inspection, spare, QR, or dashboard change:

1. Read `.agents/skills/ui-ux-pro-max/SKILL.md` before implementation.
2. Follow `docs/UI_UX_REFERENCE.md`.
3. Preserve the same required business actions across desktop/tablet/mobile; breakpoints may rearrange, never hide required capabilities.
4. Preserve contextual navigation. A drill-down from Equipment Profile to Maintenance / Inspection / Spare / QR must provide `← Trở về <equipment_id>` to the exact source profile.
5. Do not duplicate the same Equipment ID, Status, Criticality, or equivalent field twice on one screen.
6. Overlays use one scroll owner: background locked, foreground content scrolls, header/footer actions stay reachable.
7. Registration and Edit for the same entity must use the same business field model unless a field is explicitly system-managed/read-only.
8. Verify at 375, 440, 768, 1024 and 1440 px before declaring UI work complete.
9. Never fix responsive overflow by hiding Delete/Save/Cancel or another required action.
10. Global bottom navigation does not replace contextual Back navigation.
11. Equipment images follow the immutable Equipment Image Contract below. Do not change image fit/crop behavior without an explicit product decision and corresponding update to all three UI/UX rule files.

## Immutable Equipment Image Contract

This rule applies to every equipment image surface: Equipment Profile, Equipment List thumbnails, Edit Equipment, Register Equipment, preview, QR result and any future equipment-image component.

- The complete source image must always remain visible. Never crop, mask, zoom-crop, clip away corners or hide any part of the bitmap.
- Images must automatically scale UP when smaller than the available frame and scale DOWN when larger than the frame.
- Scaling must preserve the original aspect ratio. Never stretch or distort width/height independently.
- Use a fixed/predictable frame for each surface. Breakpoints may resize the frame, but must not change the image-fit behavior.
- The image stays centered in the frame.
- The implementation contract is a frame that constrains size plus an image rendered as `width:100%; height:100%; object-fit:contain; object-position:center` (or an equivalent implementation with identical visual behavior).
- `object-fit: cover`, background-image cover behavior, manual crop transforms, negative offsets, and aspect-ratio distortion are forbidden for equipment images.
- Equipment List thumbnails must use one consistent frame size within the list so source-image dimensions cannot change row height or break layout.
- A UI change involving equipment images is not complete until tested with: small source image, very large source image, portrait image, landscape image, and square image.

Work on feature branches / pull requests, not directly on main.
Before merge: tests, build, lint, Chromium/Pixel 7/WebKit automated smoke,
Supabase diagnostics when database behavior changed, confirmed Vercel project/deployment visibility,
production smoke as applicable, and final DB/Storage reconciliation where relevant must pass.
Android and iPhone camera scans are separate physical-device gates. Browser emulation
cannot satisfy them. Do not merge while any required gate is failing or unverified.
