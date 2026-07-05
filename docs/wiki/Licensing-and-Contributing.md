# Licensing & Contributing

Overlord uses a **dual-track licensing model**. This page is a practical summary — the full texts in [LICENSE](../../LICENSE), [LICENSING.md](../../LICENSING.md), [BRAND-ASSETS-LICENSE.md](../../BRAND-ASSETS-LICENSE.md), and [COMMERCIAL-LICENSE-AGREEMENT.md](../../COMMERCIAL-LICENSE-AGREEMENT.md) control if anything conflicts.

## Source code: AGPL-3.0-or-later

Unless a file says otherwise, all source code is licensed under:

```text
SPDX-License-Identifier: AGPL-3.0-or-later
```

You may use, copy, modify, and distribute the code under AGPL terms. The key obligation: **if you modify AGPL-covered code and let users interact with it over a network** (which a Discord bot and web dashboard do), **you must provide the corresponding source of your modified version** under the AGPL.

Third-party dependencies, generated code, fonts, and icons keep their own licenses.

## Brand assets: all rights reserved

The AGPL grant does **not** cover Overlord's protected materials:

- the **Overlord** name, marks, and product names,
- logos, mascots, visual identity, and brand artwork,
- marketing copy, landing-page positioning, screenshots, videos, pitch materials,
- design source files and brand guidelines,
- domains, social handles, and sales material.

You may keep them only as far as strictly necessary to view/test/develop the unmodified repository locally.

## Forks and public deployments

Forking and building on the code is welcome under the AGPL. Before **publicly deploying or distributing** a fork:

1. Replace all protected Overlord brand materials (name, logos, marketing content) with your own, unless you hold a written brand license.
2. Don't present your fork as the official Overlord product or an endorsed service.
3. Comply with the AGPL network-source obligation for your modifications.

## Commercial licensing

A separate commercial license is available if you want to:

- use the software without AGPL source-sharing obligations,
- embed it in a proprietary product,
- run a hosted/managed service under commercial terms,
- use protected brand materials with permission,
- get private support or custom development.

Commercial terms require a signed written agreement — see the template in `COMMERCIAL-LICENSE-AGREEMENT.md`.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md). In short:

- Contributions are licensed `AGPL-3.0-or-later`, and you grant the project owner the right to also relicense your contribution under commercial agreements (required for the dual-license model to work).
- Don't submit third-party brand assets, fonts, or images without documented rights.
- Never submit tokens, credentials, database dumps, or other secrets.

### Development notes for contributors

- Two workspaces: `bot/` (TypeScript, Discord.js) and `dashboard/` (Next.js). Install and build each separately.
- The main Prisma schema of record is `bot/prisma/schema.prisma`; the dashboard copies it during `npm run generate`.
- Run `npm test` and `npm run build` in both workspaces before submitting.
- Dashboard UI follows the conventions in `AGENTS.md`: Tailwind-first, existing design tokens, `ru`/`en` strings on every user-facing surface.
- Bot replies must be localized through `bot/src/utils/i18n.ts` (`ru` and `en`).
