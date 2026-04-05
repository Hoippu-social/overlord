# Dashboard Figma Design System Rules

These rules apply when implementing or updating UI in `dashboard/**`, especially for Figma-driven work. The `bot/**` project is backend-focused and is out of scope for these visual rules unless a task explicitly touches dashboard-to-bot integration.

## Project Scope and Stack

- The primary Figma target in this workspace is `dashboard/`, a Next.js 16 App Router app using React 19 and strict TypeScript.
- Use the `@/*` path alias for dashboard imports; it resolves to `dashboard/src/*`.
- Route files live in `dashboard/src/app/**`.
- Reusable UI lives in `dashboard/src/components/**`, organized mostly by feature area (`landing`, `stats`, `moderation`, `tickets`, `commands`, `music`) plus a small shared layer.
- Shared components usually use named exports. Keep `default export` for Next route files and for feature-local components only where that folder already follows that pattern.
- Global app providers live in `dashboard/src/app/providers.tsx` and already wrap `SessionProvider`, `NextThemesProvider`, and `NextUIProvider`. Do not duplicate app-level providers inside Figma-derived components.

## Component Placement and Reuse

- IMPORTANT: Reuse existing dashboard shells and primitives before creating new wrappers.
- Dashboard layout/navigation patterns already exist in `dashboard/src/components/DashboardLayout.tsx`, `dashboard/src/components/Sidebar.tsx`, `dashboard/src/components/TopNav.tsx`, and `dashboard/src/components/StatsNav.tsx`.
- `dashboard/src/components/DashboardLayout.tsx` is the default guild-scoped shell. When implementing a full dashboard surface under `dashboard/src/app/dashboard/[guildId]/**`, compose with that shell instead of rebuilding sidebar and header chrome.
- Stats subroutes already layer `StatsNav` through `dashboard/src/app/dashboard/[guildId]/stats/layout.tsx`. Extend that layout pattern instead of rendering a second stats tab strip inside each stats page.
- Section/card framing already exists in `dashboard/src/components/SectionBlock.tsx`. Prefer extending this pattern for new dashboard sections instead of inventing a separate card system.
- Save-state affordances belong with `dashboard/src/components/common/FloatingSaveBar.tsx`.
- Feature-specific primitives should stay inside their feature directory, for example `dashboard/src/components/moderation/ui.tsx`.
- Put new generic cross-feature components directly under `dashboard/src/components/` or `dashboard/src/components/common/`. Do not create a separate design-system folder unless the project is intentionally being reorganized.

## Styling Rules

- IMPORTANT: Implement dashboard UI with Tailwind utility classes first. This codebase does not use CSS Modules or styled-components for the main dashboard surfaces.
- IMPORTANT: Map Figma colors and surfaces to the existing CSS custom properties in `dashboard/src/app/globals.css` and the Tailwind aliases in `dashboard/tailwind.config.ts`.
- Prefer Tailwind theme aliases such as `bg-background`, `text-foreground`, `bg-surface`, `bg-surface-hover`, `border-divider`, `text-primary`, `text-secondary`, `text-danger`, and `bg-primary` when they express the intended token cleanly.
- Prefer these existing tokens before introducing anything new:
  - `--bg-base`
  - `--surface-sidebar`
  - `--surface-card`
  - `--surface-hover`
  - `--color-primary`
  - `--color-primary-1`
  - `--color-primary-2`
  - `--color-success`
  - `--color-warning`
  - `--color-destructive`
  - `--text-primary`
  - `--text-secondary`
  - `--text-muted`
  - `--border-divider`
  - `--border-subtle`
  - `--border-focus`
- IMPORTANT: Do not hardcode hex, rgb, or ad hoc Tailwind colors when an existing token matches the design intent. If a new brand token is truly required, add it to `globals.css` and, if needed, `tailwind.config.ts` instead of scattering literals.
- Literal rgba/gradient values are acceptable only for already-established atmospheric treatments such as the landing and dashboard chooser hero surfaces, and only when an existing token cannot represent the effect.
- Preserve the current visual language: dark surfaces, restrained borders, large radii, strong contrast on primary actions, and soft glow/shadow accents around the green brand color.
- Reuse existing global utility classes when they match the target surface: `glass`, `animate-fade-up`, `animate-fade-in`, `no-scrollbar`, and the `landing-*` classes.
- Use mobile-first responsive Tailwind classes. Preserve the current pattern of persistent desktop sidebar plus mobile sheet/menu behavior where applicable.

## Typography and Motion

- Body copy should use `font-sans`, which is wired to the local Futura family in `dashboard/src/app/layout.tsx`.
- Display headings and branded labels should use `font-akony`.
- Keep the current high-character display treatment for major headings: bold, compact tracking, and strong contrast.
- Motion should stay restrained and purposeful. Prefer the existing fade/slide patterns over introducing elaborate new animation systems.
- Do not add a light theme or system-theme branching unless the task explicitly requires it. The dashboard currently runs as a dark-first experience.

## UI Library Rules

- Prefer custom Tailwind markup for dashboard shells, panels, landing sections, and custom settings surfaces.
- Use NextUI components only where the existing subtree already uses NextUI or where a simple existing primitive is clearly the best fit.
- Use `@phosphor-icons/react` first for new icons because it is already a dominant icon source in the dashboard.
- Do not install additional icon packages for Figma parity if the needed asset can come from Figma or from packages already present in `dashboard/package.json`.

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

### Required Flow

1. Run `get_design_context` first for the exact Figma node or nodes being implemented.
2. If the response is too large or truncated, run `get_metadata` to identify the relevant subtree, then re-run `get_design_context` for only the needed nodes.
3. Run `get_screenshot` for a visual reference of the exact variant being implemented.
4. Only after you have both structure and screenshot should you fetch assets and start implementation.
5. Treat the Figma output as a design specification, not as final project-ready code.
6. Translate the design into this repo's Next.js App Router, TypeScript, Tailwind, token, and component conventions.
7. Validate the finished UI against the Figma screenshot at both desktop and mobile sizes before marking the task complete.

### Implementation Rules

- IMPORTANT: Reuse existing components from `dashboard/src/components/**` wherever the behavior or layout is already available.
- IMPORTANT: Translate Figma spacing, colors, typography, and border treatments into the project's existing token system before considering new values.
- Keep presentational UI in `dashboard/src/components/**` and route composition in `dashboard/src/app/**`.
- Prefer server route files that assemble existing client components over turning whole pages into client components. `DashboardLayout`, `Sidebar`, `TopNav`, `StatsNav`, and most interactive settings surfaces are already client-side boundaries.
- Use `'use client'` only for interactive components that need hooks, browser APIs, animation state, or client navigation.
- Keep page and layout files as server components by default when interactivity is not required.
- Use `next/link` for navigation and `next/navigation` hooks inside client components.
- Respect existing providers in `dashboard/src/app/providers.tsx` for theme, auth, and NextUI context.
- Preserve existing locale behavior. The dashboard defaults to `ru` via `dashboard/src/lib/i18n.ts`; if a changed surface already has `en` and `ru` strings, update both and continue using `useGuildLocale` or the existing locale helper instead of inventing a new i18n layer.
- Do not move data-fetching logic into presentational components if a `src/lib/**` helper or route handler already owns that concern.

## Asset Handling

- IMPORTANT: If the Figma MCP server returns a localhost image or SVG source, use that source directly rather than recreating the asset.
- Store exported static assets in `dashboard/public/assets/` unless they clearly belong with existing folders such as `dashboard/public/logos/` or `dashboard/public/icons/`.
- Reuse existing brand assets from `dashboard/public/logos/` when possible.
- Do not add placeholder art if the Figma payload already includes the real asset.

## Validation

- Run `npm run lint` in `dashboard/` after Figma-driven UI changes.
- Run `npm run build` in `dashboard/` when the change affects routes, layout composition, config, or anything likely to surface type/runtime issues outside the edited component.
- Verify the result visually against the Figma screenshot and against the existing dashboard chrome at desktop and mobile widths.
- If navigation or shell UI changes, explicitly verify both the desktop fixed sidebar state and the mobile sheet/header behavior around the `md` breakpoint.
