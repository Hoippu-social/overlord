# Overlord - Style Reference
> Discord Command Center

## Theme

Dark-first. The product should feel like a premium operations room for Discord communities: focused, controlled, and alive only where action is needed. The canvas is near-black, surfaces are layered by subtle neutral shifts, and the brand signal is a vivid green used for decisive actions, active states, and focus glows.

This adapts the Mercury reference away from violet-blue fintech calm and into Overlord's identity: command authority, server governance, audit memory, moderation, analytics, tickets, voice, and guild control. Keep the cinematic restraint, but ground every UI choice in an operational Discord dashboard.

## Tokens - Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Overlord Green | `#75f16a` | `--color-primary`, `--color-primary-1` | Primary CTA, active nav icon backgrounds, save actions, key focus rings, high-value status emphasis. |
| Arc Violet | `#8f5eff` | `--color-primary-2` | Secondary accent for atmospheric gradients and rare hover alternatives. Do not make it the main dashboard action color. |
| Base Black | `#060606` | `--bg-base` | App background and deepest page layer. |
| Sidebar Black | `#0b0b0b` | `--surface-sidebar` | Persistent sidebar and shell chrome. |
| Card Black | `#111111` | `--surface-card` | Dashboard cards, section blocks, popovers, and modal surfaces. |
| Hover Charcoal | `#18181b` | `--surface-hover` | Hover states, selected rows, active nav surfaces, raised interactive areas. |
| Success | `#10b981` | `--color-success` | Success status when semantic success differs from brand action. |
| Warning | `#f59e0b` | `--color-warning` | Warning states and cautionary labels. |
| Destructive | `#f43f5e` | `--color-destructive` | Dangerous actions, moderation punishments, destructive states. |
| Primary Text | `#ffffff` | `--text-primary` | Main text and high-priority labels. |
| Secondary Text | `rgba(255, 255, 255, 0.6)` | `--text-secondary` | Body support text and inactive-but-readable copy. |
| Muted Text | `rgba(255, 255, 255, 0.3)` | `--text-muted` | Hints, disabled labels, tertiary metadata. |
| Divider | `rgba(255, 255, 255, 0.04)` | `--border-divider` | Fine separators and low-contrast panel borders. |
| Subtle Border | `#1a1a1a` | `--border-subtle` | Stronger shell and card boundaries. |
| Focus Glow | `rgba(117, 241, 106, 0.4)` | `--border-focus` | Focus rings and brand-tinted control emphasis. |

### Tailwind Aliases

Prefer these classes when they express the target clearly:

- `bg-background`, `text-foreground`
- `bg-surface`, `bg-surface-hover`
- `border-divider`
- `text-primary`, `text-secondary`, `text-danger`
- `bg-primary`

Use bracketed CSS variables when an alias is missing, for example `bg-[var(--surface-sidebar)]`.

## Tokens - Typography

### AKONY - Brand and display

- Class: `font-akony`
- Source: `dashboard/fonts/AKONY.ttf`
- Role: OVERLORD wordmark, display marks, high-character headings, section identity labels, compact uppercase dashboard labels where brand presence matters.
- Treatment: uppercase, bold visual mass, compact line height, positive tracking. Use sparingly in dense dashboard surfaces.

### Futura Cyrillic - UI and content

- Class: `font-sans`
- Source: `dashboard/fonts/FuturaCyrillic*.ttf`
- Role: body copy, controls, tables, navigation, settings, form labels, chart labels, descriptions, and localized copy.
- Weights: 400, 500, 600, 700, 800, 900 are available. Use 600-700 for dashboard labels and actions; avoid excessive 900 weight in compact controls.

### Type Guidance

| Role | Size Range | Line Height | Treatment |
|------|------------|-------------|-----------|
| micro label | 10-12px | 1.4-1.7 | uppercase, positive tracking, muted or brand green. |
| control text | 13-14px | 1.2-1.4 | bold or semibold, readable inside fixed-height controls. |
| body | 14-16px | 1.5-1.9 | secondary text for explanations and settings. |
| panel title | 16-21px | 1.15-1.35 | bold Futura or AKONY when section identity is important. |
| dashboard heading | 24-40px | 0.95-1.15 | uppercase or compact, avoid viewport-scaled font formulas in dashboard chrome. |
| landing display | 48-112px | 0.82-1.0 | AKONY, highly brand-led, only for landing or first-screen identity moments. |

## Tokens - Spacing and Shapes

Base unit: 4px.

Density: operational, not cramped. Landing pages may be spacious; dashboard pages should be dense enough for repeated work while preserving clear section grouping.

| Element | Radius | Notes |
|---------|--------|-------|
| section blocks | 24-32px | `SectionBlock` currently uses 32px. Preserve the soft premium panel shape. |
| cards/panels | 16-32px | Match nearby components before choosing a value. |
| icon cells | 16-20px | Often 40-48px square with subtle surface and border. |
| primary buttons | full pill | Use `rounded-full` for primary action buttons and save bars. |
| segmented controls | 12-16px | Outer shell 16px, active segment 12px. |
| modals/popovers | 24-28px | Follow existing NextUI modal/popover styling. |

## Component Rules

### Primary Action Button

Use `--color-primary-1`/`bg-primary` with dark text (`#07110a`, `#09120a`, or black where existing components already use it). Keep the shape pill-like, text bold, and motion subtle. Add a green glow only when the surrounding surface needs emphasis.

### Secondary Action Button

Use a dark surface with `--border-divider` or landing line tokens, white text, and hover border/text movement toward green. Do not use violet as the default secondary button unless the component already uses it or the task is explicitly atmospheric.

### Dashboard Section Block

Prefer `SectionBlock` for settings and dashboard sections. Use `bg-[var(--surface-card)]`, `border-[var(--border-divider)]`, rounded 24-32px, and a clear header/content split. Keep descriptions muted and action controls aligned to the header.

### Sidebar Nav Link

Active state: surface-hover pill with a green icon cell. Inactive state: transparent border, muted white text, hover to card/surface. Preserve the desktop fixed sidebar and mobile sheet behavior.

### Segmented Tabs

Use the shared `SegmentedTabs` for feature tab controls. Active states should be restrained: tinted green surface, thin border, soft glow. Keep tab labels from resizing the control.

### Floating Save Bar

Use `FloatingSaveBar` for dirty-state save/reset flows. Keep the opaque rounded shell, green save CTA, and circular reset icon button. Do not replace it with inline ad hoc save bars.

### Inputs and Selects

Use dark rounded fields, subtle borders, muted placeholders, and green focus rings. For role/channel menus and searchable multi-selects, reuse the approved moderation primitives in `dashboard/src/components/moderation/ui.tsx`.

### Landing Shell

Landing can use established atmospheric gradients from `landing-shell`: restrained green and violet radial light, no generic blue Mercury palette. The hero should lead with OVERLORD and Discord operations copy, not abstract financial or mountain imagery.

## Mercury-to-Overlord Translation

| Mercury Trait | Overlord Translation |
|---------------|----------------------|
| Mercury Blue primary CTA | Overlord Green primary CTA. |
| Ghost Blue hover/secondary | Dark surface with white/green hover; use green opacity or `--surface-hover`. |
| Deep Space/Midnight Slate | `--bg-base`, `--surface-sidebar`, `--surface-card`. |
| Arcadia/ArcadiaDisplay | Futura Cyrillic UI and AKONY display. |
| Mountain top command center | Discord operating system / guild command center. |
| Atmospheric hero photo | Overlord brand-first landing with operational copy and existing green/violet glow language. |
| Text-only fintech sections | Product operations modules: govern, observe, respond; moderation, analytics, tickets, voice. |
| Blue-only accent discipline | Green is primary; violet is secondary atmosphere only. |

## Do

- Use existing dashboard tokens before adding new values.
- Keep dark surfaces neutral and layered by small contrast changes.
- Reserve green for decisions, active states, focus, and primary movement.
- Use violet only as supporting energy in gradients or special secondary accents.
- Reuse dashboard shell components and feature primitives.
- Keep dashboard layouts scan-friendly: compact headers, stable controls, predictable navigation.
- Preserve localized `ru` and `en` copy when a surface already supports both.
- Validate desktop sidebar and mobile sheet/header when navigation or shell UI changes.

## Don't

- Do not copy Mercury's `#5266eb`, `#cdddff`, Arcadia fonts, or blue-first CTA system.
- Do not scatter hardcoded hex/rgb colors when a project token exists.
- Do not create a second app provider stack inside Figma-derived components.
- Do not create a separate design-system folder for routine dashboard primitives.
- Do not add a light theme unless explicitly requested.
- Do not use generic card-heavy marketing layouts inside operational dashboard screens.
- Do not use large hero typography inside compact panels, tabs, buttons, tables, or settings cards.
- Do not make dense dashboard controls shift size on hover, label changes, or loading states.

## Quick CSS Reference

```css
:root {
  --bg-base: #060606;
  --surface-sidebar: #0b0b0b;
  --surface-card: #111111;
  --surface-hover: #18181b;

  --color-primary: #75f16a;
  --color-primary-1: #75f16a;
  --color-primary-2: #8f5eff;
  --color-success: #10b981;
  --color-destructive: #f43f5e;
  --color-warning: #f59e0b;

  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-muted: rgba(255, 255, 255, 0.3);

  --border-divider: rgba(255, 255, 255, 0.04);
  --border-subtle: #1a1a1a;
  --border-focus: rgba(117, 241, 106, 0.4);
}
```

## Example Prompts

1. `Use $overlord-dashboard-identity to adapt this Mercury-style dashboard section into Overlord's visual system using existing Tailwind tokens and SectionBlock.`

2. `Use $overlord-dashboard-identity to implement a guild settings panel with green primary actions, dark layered surfaces, AKONY section labels, and Futura UI text.`

3. `Use $overlord-dashboard-identity to translate this Figma screen into the dashboard app without copying external colors or rebuilding the sidebar shell.`
