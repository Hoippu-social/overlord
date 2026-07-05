# Temporary Voice Channels

Self-service voice rooms: members join a **hub channel** and get their own temporary voice channel, which is deleted when it empties.

## Setup

Run `/setupv` (or configure in the dashboard's Temp Voice section) to designate a hub voice channel and a category for spawned rooms. Per-guild config covers the naming template, default user limit, and permissions.

## How it works

1. A member joins the hub channel.
2. The bot creates a personal voice channel, moves the member in, and marks them **owner**.
3. The owner manages the room through an interactive control panel (rename, user limit, lock/unlock, kick, transfer ownership).
4. When the last member leaves, the room is deleted.

## Persistence

- Rooms are tracked in the database (`TempVoiceRoom`), so ownership survives bot restarts.
- Per-user preferences (`UserVoiceSettings`) — preferred name, limit, privacy — are remembered and re-applied the next time that member spawns a room.

## Administration

`/tempvoice` provides admin operations; the dashboard's Temp Voice section manages the guild configuration.
