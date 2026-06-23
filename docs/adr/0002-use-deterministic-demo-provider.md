# ADR 0002: Use A Deterministic Demo Provider

## Status

Accepted

## Context

The public demo must run for free without API keys, paid hosting, or sports-data subscriptions. Recruiters should be able to clone and run the repository without configuring external providers.

## Decision

Store demo match scenarios in version-controlled JSON and read them through an infrastructure data source that maps into domain objects.

## Consequences

- Local behavior is deterministic and testable.
- The first slice exercises the intended architecture.
- Live provider concerns can be added later behind a provider boundary without changing the web app contract unnecessarily.
- Demo data must remain fictional or generic and must not include copyrighted logos or paid data.
