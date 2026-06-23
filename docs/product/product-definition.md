# Product Definition

## Summary

GoalAnthem helps a football viewer prepare a goal anthem for the team they support and play it at the right moment during a match.

## Primary Flow

Find match -> Choose team -> Choose anthem -> Set cue point -> Start match -> Everything works.

## Current Scope

The current implementation covers setup, backend-owned deterministic match sessions, local fallback match mode, and optional Spotify companion features: loading selectable matches from optional live World Cup data or deterministic demo fallback, selecting a match and team, choosing a deterministic demo anthem or local audio file, setting a cue point, starting match mode, receiving authoritative backend session snapshots over SignalR, and playing eligible local/demo audio when the supported team scores.

Spotify can be configured by a developer for browser-only account connection, track search, metadata display, and setup-time manual playback. Spotify tracks are companion/reference selections and are not automatic goal anthems.

## Users

The primary audience for the repository is technical recruiters evaluating engineering judgment, architecture, and delivery quality. The product audience is a football viewer watching a match on TV.

## Constraints

- The demo must run without API keys, paid services, or external sports-data subscriptions.
- Optional World Cup match data may be enabled with a local football-data.org token.
- Spotify is optional, browser-only, and must not be required for the primary demo.
- Spotify playback must not be triggered by match events, SignalR, score changes, clocks, kickoff synchronization, or manual goal controls.
- Demo data must be deterministic and version-controlled.
- Documentation must not claim unimplemented behavior.

## Success Criteria For The Current Slices

- A user can open the web app and see matches loaded from the backend.
- A user can see whether match data is live World Cup data or deterministic demo data.
- A user can manually refresh matches without request spam.
- A user can select a match and immediately move into team selection.
- A user can select either the home or away team and continue to anthem selection.
- A user can choose a deterministic demo anthem or a local audio file.
- A user can set and validate a cue point, preview playback, and start match mode from the Ready summary.
- A backend-owned deterministic match session updates the clock, score, and timeline after local kickoff synchronization.
- A user can explicitly fall back to local demo mode if remote session startup is unavailable.
- Supported-team goals trigger anthem playback from the cue point, while opponent goals do not.
- A user can manually trigger playback, stop playback, and end match mode.
- A user can optionally connect Spotify, search tracks, select companion metadata, and manually control setup-time Spotify playback when eligible.
- The API exposes documented provider-neutral match data and safe fallback metadata.
- Tests cover domain rules, mapping, endpoint behavior, architecture boundaries, and frontend setup behavior.
