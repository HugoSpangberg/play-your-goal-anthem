# ADR 0004: Keep Spotify Out Of Automatic Goal Playback

## Status

Accepted.

## Context

GoalAnthem automatically plays an anthem when the supported team scores. Spotify can also be useful during setup for finding a real track, showing metadata, and manually previewing playback through an eligible user account.

Spotify playback must not be synchronized to television, visual media, goal events, SignalR messages, match clocks, score changes, kickoff synchronization, full time, local simulation events, or manual goal controls.

## Decision

Model Spotify as a companion/reference integration, not as an automatic anthem source.

Automatic goal playback remains restricted to browser-owned demo audio and local audio files. Spotify OAuth state, PKCE verifier, tokens, authorization code, player state, and playback commands stay in the browser. The backend does not receive Spotify credentials or local audio files.

Spotify setup supports browser-only Authorization Code with PKCE, Web API track search, metadata display, and setup-time manual Web Playback SDK controls after explicit user interaction.

## Consequences

- The app remains usable without Spotify, secrets, or paid services.
- Spotify tracks can be selected as companion metadata, but goals never start, seek, pause, resume, queue, or transfer Spotify playback.
- Type boundaries keep automatic `AnthemSelection` limited to demo and local audio.
- Future external providers must stay behind explicit boundaries and must not weaken this policy boundary without a new ADR.
