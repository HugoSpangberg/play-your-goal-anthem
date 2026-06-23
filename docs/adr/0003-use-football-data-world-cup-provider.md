# ADR 0003: Use football-data.org For Optional World Cup Match Data

## Status

Accepted.

## Context

The primary demo must work without API keys, but the match-selection screen should optionally show real upcoming FIFA World Cup matches when a user provides a free API token.

## Decision

Use football-data.org v4 with competition code `WC` behind the backend match-provider boundary. The frontend never calls football-data.org directly and never receives the API token.

The deterministic JSON demo provider remains the zero-configuration fallback. If no token is configured, or if the live provider fails and no cached live response is available, the API returns demo data with source and fallback metadata.

## Consequences

- The repository remains demonstrable without secrets or paid services.
- Live World Cup match selection can be demonstrated with `FootballData__ApiToken`.
- Detailed live goal-event detection is not implemented by this decision.
