---
name: overlord-dashboard-identity
description: Adapt external design references, Figma specs, dashboard screens, landing sections, and UI components to the Overlord dashboard identity in D:\discord_bot\Dev\dashboard. Use when a user asks to apply "our identity", "Overlord identity", visual brand rules, dashboard styling, design-system tokens, or to translate references such as Mercury into the existing Next.js/Tailwind/Futura/AKONY dark command-center visual language.
---

# Overlord Dashboard Identity

## Overview

Use this skill to convert external style references into the Overlord dashboard visual system. Treat references like Mercury as inspiration only; implement with the existing dashboard tokens, components, typography, layout shells, and dark-first product language.

## Workflow

1. Inspect the current dashboard surface before changing UI:
   - `dashboard/src/app/globals.css`
   - `dashboard/tailwind.config.ts`
   - `dashboard/src/app/layout.tsx`
   - the route or component being changed
2. Load `references/overlord-style-reference.md` when the task needs detailed color, typography, component, or prompt guidance.
3. Translate borrowed design traits into Overlord equivalents:
   - Replace blue/violet primary CTAs with `--color-primary` or `--color-primary-1`.
   - Keep violet as a secondary atmospheric accent via `--color-primary-2`, not as the default primary action.
   - Replace custom external fonts with `font-sans` for UI/body and `font-akony` for brand/display labels.
   - Replace generic command-center imagery with Overlord's Discord operations language: moderation, analytics, tickets, voice, audit, roles, and guild control.
4. Reuse existing dashboard structure before creating new primitives:
   - `DashboardLayout`, `Sidebar`, `TopNav`, `StatsNav`
   - `SectionBlock`
   - `FloatingSaveBar`
   - feature-local primitives such as `moderation/ui.tsx`
5. Implement with Tailwind utilities and existing CSS variables. Add new tokens only when the current token set cannot express the design intent.
6. Validate after UI code changes with `npm run lint` in `dashboard/`; run `npm run build` when routes, layout composition, or shared behavior changed.

## Core Rules

- Preserve the Overlord mood: premium Discord operations surface, dark command center, precise, authoritative, calm, and low-noise.
- Use `--bg-base`, `--surface-sidebar`, `--surface-card`, `--surface-hover`, `--color-primary`, `--color-primary-1`, `--color-primary-2`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-divider`, `--border-subtle`, and `--border-focus`.
- Use `font-akony` for Overlord branding, display marks, compact uppercase labels, and strong section identity. Use `font-sans` for body copy, controls, tables, forms, navigation, and dashboard text.
- Use `@phosphor-icons/react` first for new icons.
- Keep page files as server components unless hooks, browser APIs, animation state, or client navigation are required.
- Preserve existing `ru`/`en` locale behavior when changing copy on localized surfaces.
- Do not introduce a light theme, new provider layer, CSS Modules, styled-components, or a separate design-system folder for routine dashboard work.

## Reference

Read `references/overlord-style-reference.md` for the adapted Mercury-to-Overlord style reference, including token tables, component rules, do/don't guidance, and prompt examples.
