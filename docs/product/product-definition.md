# Product Definition

## Summary

GoalAnthem helps a football viewer prepare a goal anthem for the team they support and play it at the right moment during a match.

## Primary Flow

Find match -> Choose team -> Choose anthem -> Set cue point -> Start match -> Everything works.

## Current Scope

The current implementation covers setup, backend-owned deterministic match sessions, local fallback match mode, and local audio import: loading selectable matches from optional live World Cup data or deterministic demo fallback, selecting a match and team, choosing a deterministic demo anthem or local audio file, setting a cue point, starting match mode, receiving authoritative backend session snapshots over SignalR, and playing eligible demo/local audio when the supported team scores.

Users can open an external royalty-free discovery site such as Pixabay Music, download a track directly from that site, return to GoalAnthem, and import the downloaded file as browser-local audio. Optional source metadata is only a user-maintained record.

## Users

The primary audience for the repository is technical recruiters evaluating engineering judgment, architecture, and delivery quality. The product audience is a football viewer watching a match on TV.

## Constraints

- The demo must run without API keys, paid services, or external sports-data subscriptions.
- Optional World Cup match data may be enabled with a local football-data.org token.
- Supported anthem sources are deterministic demo audio, local audio files, and local files downloaded separately from royalty-free discovery sites such as Pixabay.
- Pixabay is not a streaming provider, API dependency, account flow, or legal-verification system.
- Demo data must be deterministic and version-controlled.
- Documentation must not claim unimplemented behavior.

## Success Criteria For The Current Slices

- A user can open the web app and see matches loaded from the backend.
- A user can see whether match data is live World Cup data or deterministic demo data.
- A user can manually refresh matches without request spam.
- A user can select a match and immediately move into team selection.
- A user can select either the home or away team and continue to anthem selection.
- A user can choose a deterministic demo anthem or a local audio file.
- A user can use the Pixabay guide, import a downloaded local file, and optionally record source metadata.
- A user can set and validate a cue point, preview playback, and start match mode from the Ready summary.
- A backend-owned deterministic match session updates the clock, score, and timeline after local kickoff synchronization.
- A user can explicitly fall back to local demo mode if remote session startup is unavailable.
- Supported-team goals trigger anthem playback from the cue point, while opponent goals do not.
- A user can manually trigger playback, stop playback, and end match mode.
- The API exposes documented provider-neutral match data and safe fallback metadata.
- Tests cover domain rules, mapping, endpoint behavior, architecture boundaries, and frontend setup behavior.
