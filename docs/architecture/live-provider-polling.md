# Adaptive live provider polling

GoalAnthem uses multiple backend-only football data sources for normal-speed match sessions. Free provider data is best-effort and cannot guarantee instant or correct goal detection. The manual anthem control remains available at all times.

## Provider roles

| Provider | Status | Default cadence | Purpose |
|---|---|---:|---|
| OpenLigaDB | Active, no credential | 20 seconds, offset 0 seconds | Fast community observation source |
| football-data.org | Active when configured | 300 seconds, offset 43 seconds | Fixture source and delayed score confirmation |
| API-Football | Placeholder only | Reserved 75 seconds, offset 17 seconds | Future quota-aware livescore source |

Polling happens only while at least one normal-speed session is active. Demo-speed sessions stay deterministic and never call external providers. One response from a provider is shared across all active sessions.

## Observation rules

- Match observations are resolved by country/team identity and kickoff proximity.
- Scores are monotonic. A delayed lower score never rolls back a newer score.
- Goal event identifiers are based on session, side, and score milestone, so duplicate reports from different providers produce one event.
- Normal mode advances the TV-synchronized clock locally but does not generate deterministic goals.
- Demo mode uses deterministic events and does not consume live provider data.
- Provider failure never stops the clock or manual audio fallback.

## Configuration

OpenLigaDB requires no credential:

```text
OpenLigaDb__Enabled=true
OpenLigaDb__LeagueShortcut=wm26
OpenLigaDb__Season=2026
OpenLigaDb__RefreshSeconds=20
OpenLigaDb__StartDelaySeconds=0
```

The competition shortcut is configurable because community dataset identifiers may change before the tournament.

football-data.org uses the existing ASP.NET Core secret:

```bash
dotnet user-secrets set \
  "FootballData:ApiToken" \
  "YOUR_TOKEN" \
  --project src/GoalAnthem.Api
```

API-Football has reserved placeholder configuration, but its outbound adapter is not active in this slice:

```text
ApiFootball__Enabled=false
ApiFootball__AccessValue=
ApiFootball__RefreshSeconds=75
ApiFootball__StartDelaySeconds=17
ApiFootball__DailyLimit=100
ApiFootball__SafetyReserve=4
```

Provider credentials must remain in backend configuration or user secrets and must never be sent to the React app.

## Diagnostics

- `GET /health/matches-provider`
- `GET /health/live-providers`

The live-provider endpoint reports configuration state, cadence, last attempt, last success, next run, backoff, latest failure, and quota metadata where available. It does not expose credentials.

## Registration and documentation

- football-data.org registration: `https://www.football-data.org/client/register`
- API-Football dashboard: `https://dashboard.api-football.com/`
- API-Football documentation: `https://www.api-football.com/documentation`
- OpenLigaDB website: `https://openligadb.de/`
- OpenLigaDB Swagger: `https://api.openligadb.de/index.html`

OpenLigaDB needs no API key.
