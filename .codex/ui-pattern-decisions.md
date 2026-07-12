# UI Pattern Decisions

Keep only explicit user approvals here. The latest section with `status: approved` for a given element kind is the default choice for future frontend work in this workspace.

## Decisions

### dropdown
- status: approved
- approved_on: 2026-03-17
- chosen_pattern: Moderation role/channel picker based on InteractiveSelect and MultiSelectField
- source_file: dashboard/src/components/moderation/ui.tsx
- usage_examples:
  - dashboard/src/components/moderation/tabs/AccessControlTab.tsx
  - dashboard/src/components/moderation/tabs/AiModerationTab.tsx
  - dashboard/src/components/moderation/tabs/AutoModTab.tsx
  - dashboard/src/components/moderation/tabs/OverviewTab.tsx
- reuse_scope: Reuse for dashboard role menus, channel menus, searchable single-selects, and searchable multi-selects that should match the Moderation visual language.
- exceptions: Ask again for compact toolbar selectors, command-palette behavior, non-searchable native selects, or layouts that need a very different density.
- notes: Use InteractiveSelect for single choice and MultiSelectField for multi-choice. Keep the dark rounded trigger, searchable autocomplete behavior, and chip-based multi-select presentation aligned with the Moderation implementation.

### modal
- status: approved
- approved_on: 2026-03-18
- chosen_pattern: NextUI modal shell styled like CategoryModal (dark surface, rounded frame, blurred backdrop, header/body/footer separators)
- source_file: dashboard/src/components/tickets/CategoryModal.tsx
- usage_examples:
  - dashboard/src/components/tickets/CategoryModal.tsx
  - dashboard/src/components/moderation/tabs/AccessControlTab.tsx
- reuse_scope: Reuse for dashboard create/edit dialogs that need one focused input or short form flow.
- exceptions: Ask again for long multi-tab workflows, wizard steps with progress, or full-screen editor experiences.
- notes: Keep modal classNames aligned with the approved shell and preserve explicit action buttons in the footer.

### floating-save-bar
- status: approved
- approved_on: 2026-03-18
- chosen_pattern: Unified fixed bottom Save/Reset pill bar (`FloatingSaveBar`) with opaque surface, primary save CTA, and circular reset icon button
- source_file: dashboard/src/components/common/FloatingSaveBar.tsx
- usage_examples:
  - dashboard/src/app/dashboard/[guildId]/moderation/page.tsx
  - dashboard/src/app/dashboard/[guildId]/commands/page.tsx
  - dashboard/src/app/dashboard/[guildId]/music/page.tsx
  - dashboard/src/app/dashboard/[guildId]/server-settings/page.tsx
- reuse_scope: Reuse for all dashboard pages that have dirty-state save/reset flows and need a floating action bar.
- exceptions: Ask again for pages that require more than 2 actions, destructive-only bars, or static inline save controls.
- notes: Keep the container opaque (no transparency), preserve the same fixed-bottom animation/positioning, and keep Save/Reset button proportions consistent.

### terminology-tooltip
- status: approved
- approved_on: 2026-07-10
- chosen_pattern: Portal-based compact question-mark tooltip (`TermHint`) with viewport-aware positioning
- source_file: dashboard/src/components/tickets/primitives.tsx
- usage_examples:
  - dashboard/src/components/tickets/PrioritiesPanel.tsx
  - dashboard/src/components/tickets/TicketDetailDrawer.tsx
  - dashboard/src/components/tickets/CategoriesPanel.tsx
  - dashboard/src/components/tickets/OverviewPanel.tsx
- reuse_scope: Reuse for domain terminology, abbreviations, Discord-specific concepts, automation labels, and support-process jargon inside the tickets module.
- exceptions: Do not add it to ordinary language, self-explanatory actions, or every repeated data badge when the surrounding section already explains the same term.
- notes: Hover opens on desktop; click/tap toggles on touch and keyboard. Render through a body portal so card overflow never clips the explanation.

### emoji-picker
- status: approved
- approved_on: 2026-07-11
- chosen_pattern: Economy `EmojiField` picker with common emoji grid, optional server emojis, custom Discord emoji input, and preview trigger
- source_file: dashboard/src/components/economy/primitives.tsx
- usage_examples:
  - dashboard/src/components/economy/ConfigPanel.tsx
  - dashboard/src/components/economy/ShopPanel.tsx
  - dashboard/src/components/tickets/CategoriesPanel.tsx
  - dashboard/src/components/tickets/TicketPanelMessageDesigner.tsx
  - dashboard/src/components/moderation/tabs/AppealsTab.tsx
- reuse_scope: Reuse for every dashboard setting that lets an administrator choose, enter, or change an emoji.
- exceptions: Do not use for a static emoji preview or a non-editable Discord payload.
- notes: Prefer server emoji data when the surface already has it; otherwise preserve the common grid and custom Discord emoji input.

## Entry Template

### dropdown
- status: approved
- approved_on: 2026-03-17
- chosen_pattern: NextUI bordered Select with rounded popover
- source_file: dashboard/src/app/dashboard/[guildId]/audit/page.tsx
- usage_examples:
  - dashboard/src/app/dashboard/[guildId]/audit/page.tsx
  - dashboard/src/app/dashboard/[guildId]/music/page.tsx
- reuse_scope: Reuse for dashboard filters, settings panels, and other single-select forms.
- exceptions: Ask again for multi-select, async search, tag input, or command-palette behavior.
- notes: Keep trigger and popover styling aligned with the approved source.
