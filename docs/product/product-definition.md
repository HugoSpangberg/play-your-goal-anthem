# Product Definition

## Summary

GoalAnthem helps a football viewer prepare a goal anthem for the team they support and play it at the right moment during a match.

## Primary Flow

Find match -> Choose team -> Choose anthem -> Set cue point -> Start match -> Everything works.

## Current Scope

The current implementation covers the setup and local match-mode demo: loading selectable matches from optional live World Cup data or deterministic demo fallback, selecting a match and team, choosing a deterministic demo anthem or local audio file, setting a cue point, starting match mode, and playing the anthem when the supported team scores in the local simulation.

## Users

The primary audience for the repository is technical recruiters evaluating engineering judgment, architecture, and delivery quality. The product audience is a football viewer watching a match on TV.

## Constraints

- The demo must run without API keys, paid services, or external sports-data subscriptions.
- Optional World Cup match data may be enabled with a local football-data.org token.
- Spotify is optional future work and must not be required for the primary demo.
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
- A deterministic match mode updates the clock, score, and timeline after local kickoff synchronization.
- Supported-team goals trigger anthem playback from the cue point, while opponent goals do not.
- A user can manually trigger playback, stop playback, and end match mode.
- The API exposes documented provider-neutral match data and safe fallback metadata.
- Tests cover domain rules, mapping, endpoint behavior, architecture boundaries, and frontend setup behavior.
