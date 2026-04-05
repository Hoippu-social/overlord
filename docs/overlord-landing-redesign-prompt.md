# Overlord Landing Redesign Prompt

Use this prompt when redesigning the public Overlord landing in this repository.

## Production Prompt

```md
Use these skills in this order:
- [$frontend-skill](C:/Users/ilyak/.codex/skills/frontend-skill/SKILL.md)
- [$ui-pattern-reuse](C:/Users/ilyak/.codex/skills/ui-pattern-reuse/SKILL.md)
- If a Figma file or node is part of the task, also use [$figma-implement-design](C:/Users/ilyak/.codex/skills/figma-implement-design/SKILL.md) and load [$figma-use](C:/Users/ilyak/.codex/skills/figma-use/SKILL.md) before any Figma write action.

Redesign the public Overlord landing page in this repo so it captures the cinematic pacing, premium motion, and large-scale visual confidence of the reference direction, but remains unmistakably Overlord.

This is not a clone. Do not turn the product into a newsletter platform, do not import the Mindloop monochrome brand, and do not replace Overlord's current visual identity with generic minimalism.

Project context:
- Framework: Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS.
- Current landing entry: `dashboard/src/app/page.tsx`
- Current landing components:
  - `dashboard/src/components/landing/Navbar.tsx`
  - `dashboard/src/components/landing/HeroSection.tsx`
  - `dashboard/src/components/landing/ManifestoSection.tsx`
  - `dashboard/src/components/landing/ModulesSection.tsx`
  - `dashboard/src/components/landing/LogicSection.tsx`
  - `dashboard/src/components/landing/Footer.tsx`
- Current landing copy and section structure live in `dashboard/src/locales/landing.ts`
- Follow project rules in `AGENTS.md`

Hard constraints:
- Keep this in the existing Next.js app. Do not switch to Vite.
- Do not add shadcn/ui.
- Do not replace the current font system with Inter or Instrument Serif.
- Do not convert the brand to a pure black/white monochrome theme.
- Do not introduce a generic SaaS card-grid landing.
- Do not use glass or liquid-glass styling. No frosted pills, no blurred translucent cards, no glossy iOS-style surfaces.
- Do not use the template videos from the source prompt.
- 3D graphics are mandatory and must be part of the composition, not an optional extra.
- Preserve the bilingual structure (`ru` and `en`) already used in `dashboard/src/locales/landing.ts`.
- Reuse and evolve the existing landing component structure instead of rebuilding from scratch in unrelated files.

Visual direction to preserve:
- Overlord is a dark, high-control, command-center brand, not an editorial lifestyle brand.
- Keep the current Overlord atmosphere from `dashboard/src/app/globals.css`: near-black base, sharp white text, green primary accent, subtle violet secondary accent, restrained glow, solid dark surfaces, and high-contrast typography.
- Keep `font-sans` for body copy via the local Futura setup and `font-akony` for display moments and brand signatures.
- Preserve the tracked uppercase labels, strong spacing rhythm, and premium motion restraint already present in the landing.
- The page should feel more immersive and more cinematic than the current version, but still clearly belong to the same design family.
- The visual anchor should come from 3D structure, depth, particles, topology, or a branded abstract object field rather than from stock footage or glassmorphism.

Technology and implementation rules:
- Use Framer Motion for reveals, section presence, and one meaningful scroll-linked effect.
- Prefer existing project packages and patterns first.
- Use `@phosphor-icons/react` for icons instead of introducing a new icon set unless absolutely required.
- Use `next/image` and `next/link` where appropriate.
- Use `'use client'` only in components that need hooks, motion state, or browser APIs.
- Extend existing landing classes and tokens in `dashboard/src/app/globals.css` instead of scattering one-off styles.
- Reuse the 3D-capable stack already present in the repo before adding anything new:
  - `three`
  - `react-force-graph-3d`
  - existing dynamic import patterns for client-only rendering, as seen in `dashboard/src/app/dashboard/[guildId]/stats/contacts/page.tsx`
- Prefer procedural or code-driven 3D scenes over downloaded video backgrounds.
- Do not add `hls.js` unless the user explicitly asks for video again in a later iteration.

Design thesis:
- Build a first viewport that feels like a poster for command, clarity, and total operational awareness.
- Use 3D depth, disciplined typography, and strong negative space, not floating dashboard cards.
- Each section gets one job: declare authority, explain philosophy, show systems, show operational flow, convert.

Mandatory 3D art direction:
- 3D is a required design element.
- The hero must include a real 3D scene or 3D-driven visual system as the dominant visual anchor.
- The 3D language should feel tactical, intelligent, and operational: network constellations, command nodes, spatial signal fields, orbital lines, volumetric point clouds, branded wireframe structures, or another Overlord-specific abstract system.
- Do not use fake 3D made only from layered CSS cards.
- Do not let 3D become a toy demo detached from product meaning. It should support the idea of control, signal, systems, and orchestration.
- Add at least one secondary 3D echo outside the hero, for example in the systems section or final CTA, so the 3D language feels systemic across the page.

Section plan:
1. Navbar
- Keep it fixed and transparent/near-transparent.
- Reuse the current Overlord brand lockup and section anchors.
- Keep login and language switching.
- Improve presence and spacing, but do not lose the existing structure.

2. Hero
- Convert the hero into a 3D-led first screen with Overlord branding and a tighter, more dramatic composition.
- Keep Overlord product positioning: Discord operations, moderation, analytics, tickets, voice.
- Do not introduce an email newsletter form. Primary action remains entering/opening the dashboard or login flow.
- Add one proof/signal row near the hero copy. This can be operator metrics, server coverage, response speed, or a similarly credible product proof.
- Motion should feel deliberate, not flashy.
- The 3D scene should be visible immediately in the first viewport and should feel like part of the brand, not a background wallpaper.

3. Philosophy / Manifesto section
- Evolve the current manifesto into a more cinematic editorial block.
- Use stronger hierarchy, tighter copy grouping, and clearer progression from principle to principle.
- Preserve the current "serious operator" tone.

4. Systems section
- Rework the current modules section into a stronger capability showcase inspired by the reference's visual pacing.
- Translate the reference's three-card/platform logic into Overlord product capabilities such as Govern / Observe / Respond, or Moderation / Analytics / Tickets.
- Do not use ChatGPT / Perplexity / Google branding here unless the product strategy explicitly changes. This section should describe Overlord, not outside brands.
- Use this section to echo or extend the 3D design language with a secondary spatial motif, data topology, or technical visual layer if it strengthens the composition.

5. Operational cadence section
- Keep the current signal -> route -> execute narrative, but give it more visual tension and breathing room.
- Use one subtle scroll-linked interaction or staged reveal here.

6. Final CTA
- Create a large atmospheric conversion section with strong depth and a controlled 3D or spatial-light presence.
- Keep the CTA tied to Overlord's actual product action: login, open dashboard, or begin setup.
- Make it feel decisive and premium, not promotional in a generic SaaS way.

7. Footer
- Keep it minimal and aligned with the current brand shell.

Required motion pattern:
- Create one reusable `fadeUp` helper for section reveals with staggered delays.
- Add one scroll-driven motion treatment somewhere meaningful, ideally in Hero or Operational Cadence.
- Keep animation smooth on mobile and easy to disable for reduced-motion users.
- If reduced motion is enabled, preserve the 3D composition visually but reduce camera drift, rotation, and parallax intensity.

Asset inventory and sourcing rules:
- Existing local brand assets to reuse first:
  - `dashboard/public/logos/logo-white.svg`
  - `dashboard/public/logos/logo-color.svg`
- Existing visual system source:
  - `dashboard/src/app/globals.css`
- Existing content source:
  - `dashboard/src/locales/landing.ts`

Preferred 3D asset and scene sources:
- First choice: procedurally generated 3D built in code with `three` and existing project dependencies.
- Second choice: local 3D assets committed under `dashboard/public/landing/3d/`.
- Third choice: explicitly approved external 3D assets with clear licensing, downloaded and stored locally before use.

Suggested local 3D asset structure if needed:
- `dashboard/public/landing/3d/overlord-core.glb`
- `dashboard/public/landing/3d/particle-sprite.png`
- `dashboard/public/landing/3d/noise-map.png`
- `dashboard/public/landing/3d/grid-alpha.png`

If external 3D assets are needed:
- Prefer dark, technical, minimal assets with no embedded branding
- Avoid generic sci-fi HUD kits, glossy mockup packs, colorful cyberpunk bundles, and stock footage masquerading as 3D
- Prefer official brand assets, self-authored geometry, open licensed meshes, or assets already approved by the user
- Cache them locally under `dashboard/public/landing/3d/`

Optional supporting assets if the composition needs them:
- `dashboard/public/landing/avatar-1.webp`
- `dashboard/public/landing/avatar-2.webp`
- `dashboard/public/landing/avatar-3.webp`
- `dashboard/public/landing/icon-govern.svg`
- `dashboard/public/landing/icon-observe.svg`
- `dashboard/public/landing/icon-respond.svg`

If those assets do not exist:
- either create the capability icons from existing Phosphor-based UI language,
- or source monochrome/dark-safe SVGs that visually match Overlord,
- and avoid importing random logo packs.

Content rules:
- Keep copy sharp, product-facing, and authoritative.
- Avoid newsletter/editorial wording from the original template.
- The landing must still read as a Discord command center and operations surface.
- Reuse and refine the current section semantics from `dashboard/src/locales/landing.ts` instead of replacing them with unrelated marketing language.

Validation:
- Ensure the landing works on desktop and mobile.
- Keep the first screen clean and high-impact.
- Ensure the 3D scene does not tank performance on common laptop/mobile hardware.
- Keep contrast strong over the 3D scene.
- The page should still read clearly if the 3D scene falls back to a static poster frame.
- Run `npm run lint` in `dashboard/`.
- If structural route/layout changes are made, also run `npm run build` in `dashboard/`.

Deliver:
- the implementation,
- any new asset file list,
- and a short explanation of how the redesign keeps Overlord's style while borrowing only the composition/motion discipline from the reference while making 3D a core brand element.
```

## Notes

- This prompt is tailored to the current landing codebase and should be used instead of the original Mindloop prompt.
- The Gemini share result was not directly readable during preparation, so the adaptation is based on the provided prompt and the current Overlord implementation.

