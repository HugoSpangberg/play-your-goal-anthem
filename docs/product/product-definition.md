# Product Definition

## Summary

GoalAnthem helps a football viewer prepare a goal anthem for the team they support and play it at the right moment during a match.

## Primary Flow

Find match -> Choose team -> Choose anthem -> Set cue point -> Start match -> Everything works.

## Current Scope

The current implementation covers the first two setup steps: loading deterministic demo matches, allowing the user to select one, and then choosing which team they support in that match.

## Users

The primary audience for the repository is technical recruiters evaluating engineering judgment, architecture, and delivery quality. The product audience is a football viewer watching a match on TV.

## Constraints

- The demo must run without API keys, paid services, or external sports-data subscriptions.
- Spotify is optional future work and must not be required for the primary demo.
- Demo data must be deterministic and version-controlled.
- Documentation must not claim unimplemented behavior.

## Success Criteria For The Current Slices

- A user can open the web app and see demo matches loaded from the backend.
- A user can select a match and immediately move into team selection.
- A user can select either the home or away team and return to the match list if needed.
- The API exposes documented deterministic match data.
- Tests cover domain rules, mapping, endpoint behavior, architecture boundaries, and frontend setup behavior.
