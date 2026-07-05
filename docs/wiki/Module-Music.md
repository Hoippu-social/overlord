# Music

Music playback powered by **Lavalink v4** (via `lavalink-client`), controllable from both Discord and the dashboard.

## Sources

- Direct URLs and search across the sources enabled in your Lavalink configuration (`lavalink/application.yml`).
- Optional **Spotify link resolution** when `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are configured (tracks are resolved to playable equivalents).

## Discord side

Full command set — see [Commands](Commands.md#music): `/play`, `/pause`, `/resume`, `/stop`, `/skip`, `/queue`, `/nowplaying`, `/seek`, `/volume`, `/loop`, `/shuffle`.

`/play` supports both direct links and interactive search with a source picker. The bot maintains a now-playing card that updates as playback progresses.

## Dashboard side

The Music section of the dashboard is a live remote control:

- current track with artwork and progress,
- queue view and reordering,
- search and enqueue,
- play/pause/skip/volume/seek/loop controls,
- an in-browser audio preview player.

All dashboard music actions route through the bot bridge to the live Lavalink player, so Discord and the dashboard always see the same state.

## Per-guild configuration

`MusicConfig` stores per-guild playback settings (DJ role restrictions and related options), editable from the dashboard.

## Resilience

The bot starts and runs normally without a reachable Lavalink node — Lavalink connection errors are downgraded to warnings, and music functionality activates when the node connects.
