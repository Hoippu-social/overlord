# Discord message preview design QA

- Date: 2026-07-11
- Source visual truth:
  - `F:\Codex\Temp\message-style-captures\live-editor-v1-desktop.png`
  - `F:\Codex\Temp\message-style-captures\components-v2-example.png`
- Implementation screenshots:
  - `F:\Codex\Temp\message-style-captures\discord-preview-desktop-final.png`
  - `F:\Codex\Temp\message-style-captures\discord-preview-mobile-final-2.png`
- Side-by-side evidence:
  - `F:\Codex\Temp\message-style-captures\discord-preview-comparison.png`
  - `F:\Codex\Temp\message-style-captures\discord-preview-v2-comparison.png`
- Viewports: desktop `1180 x 1000`; mobile `390 x 844`.
- States: populated Embeds V1 message and populated Components V2 message.

## Findings

No actionable P0, P1, or P2 differences remain in the Discord-message rendering scope.

- The editor and preview surroundings were intentionally left unchanged.
- The message now uses a Discord-specific font stack, avatar, author line, APP badge, timestamp, message hover surface, Discord colors, and native content density.
- Embeds use Discord geometry: 4 px accent rail, 516 px content cap, thumbnail track, responsive fields, uncropped media, footer, and timestamp.
- Components V2 use Discord containers, sections with accessories, separators, link buttons, spoilers, and 1/2/3/4-item media-gallery layouts.
- Both V1 and V2 render the ticket opener action; only link buttons show the external-link glyph.

## Required fidelity surfaces

- Fonts and typography: the dashboard Futura face no longer leaks into Discord content; the preview uses `gg sans`-compatible system fallbacks with Discord-like weights, sizes, and line heights.
- Spacing and layout rhythm: author row, avatar offset, message body, embeds, fields, accessories, gallery gaps, and action rows match Discord density. Mobile fields reflow without clipped labels.
- Colors and visual tokens: Discord-specific message, embed, mention, link, code, button, border, and status colors are isolated to the preview.
- Image quality and assets: the real Overlord logo is used for the bot avatar. Embed media preserves its aspect ratio; V2 galleries use the expected Discord crops and mosaic arrangements.
- Copy and content: Markdown, links, mentions, custom emoji, headings, quotes, lists, fenced code, fields, footer text, and timestamps render from the authored payload.
- Icons: the external-link affordance uses the existing Phosphor icon set and is omitted from non-link interaction buttons.
- Accessibility: images have alt text where authored, links are safe external links, and buttons retain semantic disabled states.

## Interaction verification

- Chromium rendered desktop and mobile states with no console errors.
- Link and interaction buttons exposed the correct hover and disabled styling.
- Responsive V2 accessory layout was checked at 390 px: the link accessory moves beneath its text instead of crushing words.

## Comparison history

- Pass 1 found three P1/P2 fidelity issues: Futura typography leaking into Discord, initials-only bot avatar, and dashboard-card geometry/cropped images. These were replaced with the Discord font stack, real logo asset, Discord embed geometry, and uncropped embed media.
- Pass 2 found incomplete V2 composition and a missing V1 opener action. V2 sections, mosaics, separators, and link buttons were rebuilt, and the opener was added to both formats.
- Pass 3 found narrow mobile field labels and a V2 accessory button compressing copy. Fields now wrap responsively and the accessory stacks under its text on narrow screens. Post-fix evidence is `discord-preview-mobile-final-2.png`.

## Verification notes

- Targeted ESLint: no errors; only deliberate `no-img-element` warnings remain for arbitrary Discord CDN/user URLs.
- Dashboard TypeScript: passed.
- Browser console: no errors.

final result: passed

---

# Ticket category flow redesign QA

- Date: 2026-07-12
- Before/reference capture: `F:\Codex\Temp\codex-clipboard-b5b95731-5674-491c-9961-673b9475adbd.png`
- Akemi UX reference: authenticated category overview, category settings, component list, quick-answer editor, and department rows at `https://akemi.life/dashboard/873909948730470400/tickets`
- Implementation screenshots:
  - `F:\Codex\Temp\message-style-captures\category-flow-desktop.png`
  - `F:\Codex\Temp\message-style-captures\category-flow-mobile.png`
- Combined before/after evidence: `F:\Codex\Temp\message-style-captures\category-flow-comparison.png`
- Viewports: desktop `1440 px`; mobile `390 px`.

## Findings

No actionable P0, P1, or P2 layout differences remain in the category-flow scope.

- The previous nested half-width form editor was replaced by a full-width category workspace.
- Desktop uses two deliberate work areas: entry points with their own forms, and ghost quick answers. Message design and Discord preview stay full-width beneath them.
- Mobile collapses every control to one column, keeps destructive actions reachable, and has a document width of exactly `390 px` with no horizontal overflow.
- Entry points support button, dropdown, or both, individual emoji/style/description, and up to five local form questions.
- Form questions support short text, paragraph, number, and a real Discord select with editable options.
- Multiple entry points and ghost answers are reflected in the Discord preview instead of a single hard-coded opener.
- Ghost answers are visibly marked as private and are handled as ephemeral replies by the bot without opening a ticket.

## Comparison history

- Pass 1 identified the core structural failure in the supplied screenshot: fields and message controls were squeezed into a nested two-column editor and the preview competed for the same narrow space.
- Pass 2 separated category flow from message composition, moved field setup into each entry point, and added a dedicated quick-answer work area.
- Pass 3 verified the real Discord payload path and replaced the select-field text fallback with Discord modal select components.

## Verification notes

- Desktop and mobile renders completed with no browser console errors.
- Mobile document width check: `390 px` viewport and `390 px` document width.
- Dashboard TypeScript: passed.
- Bot TypeScript: passed.
- Targeted dashboard ESLint: no errors; only existing deliberate `no-img-element` warnings in the Discord preview.

final result: passed
