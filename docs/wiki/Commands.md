# Slash Command Reference

All commands are slash commands. Replies are localized per guild (`ru`/`en`). Moderation commands respect per-guild role bindings and per-command grants configured in the dashboard.

## General

| Command | Description |
| --- | --- |
| `/help` | Interactive help menu |
| `/ping` | Latency check |

## Moderation

| Command | Description |
| --- | --- |
| `/warn`, `/unwarn`, `/warns` | Issue, remove, and list warnings |
| `/mute`, `/unmute` | Role-based mute management |
| `/timeout`, `/untimeout` | Discord native timeouts |
| `/kick` | Kick a member |
| `/ban`, `/unban` | Ban management (supports temporary bans) |
| `/clear` | Bulk-delete messages |
| `/lock`, `/unlock` | Lock/unlock a channel |
| `/slowmode` | Set channel slowmode |
| `/voicekick`, `/voicemove` | Kick or move members between voice channels |
| `/note` | Attach a private moderator note to a user |
| `/case`, `/cases` | Inspect a single moderation case / list a user's cases |
| `/appeal` | Submit an appeal against a sanction |
| `/appeals` | Staff-side appeal management |

Every sanction creates a **moderation case** with a sequential number per guild, visible in Discord and in the dashboard.

## Music

| Command | Description |
| --- | --- |
| `/play` | Play or queue a track/playlist (URL or search) |
| `/pause`, `/resume`, `/stop` | Playback control |
| `/skip` | Skip the current track |
| `/queue` | Show the queue |
| `/nowplaying` | Current track card |
| `/seek` | Jump to a position |
| `/volume` | Set playback volume |
| `/loop` | Loop mode (off/track/queue) |
| `/shuffle` | Shuffle the queue |

## Economy

| Command | Description |
| --- | --- |
| `/balance` | Wallet and bank balance |
| `/bank` | Deposit/withdraw between wallet and bank |
| `/daily` | Daily reward with streaks |
| `/work` | Timed work payout |
| `/crime` | Risky payout with a failure fine |
| `/rob` | Attempt to rob another member |
| `/pay` | Transfer currency to another member |
| `/shop` | Browse and buy shop items |
| `/inventory` | View owned items |
| `/use` | Consume an inventory item |
| `/quests` | Active quests and progress |
| `/leaderboard` | Guild currency leaderboard |
| `/profile` | Economy profile card |
| `/casino` | House games: blackjack, roulette, slots |
| `/coinflip` | Coin flip vs the house |
| `/rps` | Rock-paper-scissors PvP for a stake (best of 3) |
| `/tictactoe` | Tic-tac-toe PvP for a stake |
| `/economy-admin` | Admin: grants, deductions, configuration shortcuts |

Economy responses use Discord's Components v2 card layout. Both players' stakes in PvP games are escrowed for the duration of the match; the winner takes the pot minus the configured house edge.

## Tickets

| Command | Description |
| --- | --- |
| `/ticket` | Ticket management group: `close`, `claim`, `unclaim`, `hold`, `resume`, `reopen`, `add-user`, `remove-user`, `rename`, `transcript`, `blacklist`, `panel` |

Members normally open tickets through panel buttons published from the dashboard rather than commands.

## Voice

| Command | Description |
| --- | --- |
| `/setupv` | Set up the temporary-voice hub for the guild |

Temp-voice room owners manage their room through the control panel interface posted in the room, not through commands.

## Admin

| Command | Description |
| --- | --- |
| `/auditconfig` | Configure audit log routing in Discord |
| `/tempvoice` | Temp-voice administration |
| `/shutdown` | Gracefully shut down the bot (owner-restricted) |

## Registration behavior

Commands register **globally** on startup by default (propagation can take up to an hour). Setting `GUILD_ID` in `bot/.env` registers commands to that single guild instead, which propagates instantly — recommended for development.
