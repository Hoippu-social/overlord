# Economy

A full guild-currency system: wallets, a transaction ledger, configurable earning, a shop, casino and PvP games, quests, achievements, and seasons.

## Currency & wallets

Each member has a **wallet** and a **bank**. All amounts are stored as BigInt — the system is safe for very large balances. Every balance change goes through a central credit/debit path that:

- writes a **ledger entry** (`EconomyTransaction`) with an idempotency key,
- uses conditional updates to prevent double-spends under concurrency,
- applies the guild's multiplier stack where relevant (role × channel × booster × event multipliers).

## Earning

15 toggleable earn sources, each with per-guild rates and cooldowns, including:

- **Messages** and **voice minutes** (buffered, anti-spam aware)
- **Daily** rewards with streaks
- **Work / crime / rob** command actions with cooldowns and risk
- **Reactions**, **server boosts**, **invites** (with maturation to prevent fake-invite farming)
- **Ticket ratings** bonus
- **Birthdays**, **stats-top placements**, **clean moderation record** bonuses

## Shop & inventory

Admin-defined shop items: role grants, custom items, consumables. Members buy with `/shop`, view with `/inventory`, consume with `/use`. Items can have stock limits, purchase limits, and role requirements.

## Games

All games escrow stakes up front; payouts go through the ledger like any other transaction.

- **vs house** — blackjack, roulette, slots, coinflip.
- **PvP** — rock-paper-scissors (best of 3) and tic-tac-toe, played entirely with Discord buttons. Both players' stakes are escrowed; the winner takes the pot minus the configured house edge.

Games render as interactive Components-v2 cards; only the initiating player (or the invited opponent) can press their own game's buttons.

## Quests & achievements

- **Quests** — template-driven (daily/weekly/one-off) with progress tracking and currency rewards.
- **Achievements** — long-term milestones with one-time unlock rewards.

## Events & seasons

- **Event windows** — timed multipliers, airdrops, and lotteries executed by the bot's background sweep.
- **Seasons** — competitive periods with final standings (`EconomySeasonResult`) and configurable rewards; season endings are executed by the bot to guarantee a consistent snapshot.

## Moderation & lifecycle integration

- **Fines** — moderation cases can automatically fine the sanctioned member (configurable per action type).
- **Confiscation** — banned members' balances can be confiscated.
- A background lifecycle service (1-minute and 1-hour sweeps) handles lotteries, salaries, taxes, invite maturation, rent, birthdays, stats-top payouts, clean-record bonuses, world events, achievement checks, and PvP match expiry.

## Dashboard

The Economy section mirrors the tickets workspace pattern with nine tabs: **Overview**, **Wallets**, **Earn Sources**, **Shop**, **Role Rules**, **Quests**, **Events**, **Ledger**, and **Config**.

Money amounts cross the dashboard API as strings (BigInt-safe). All money **mutations** from the dashboard (grants, season endings) route through the bot bridge so the ledger and audit log always fire — the dashboard never writes balances directly.
