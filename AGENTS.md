# GoalAnthem Agent Instructions

## Product Summary

GoalAnthem is a public portfolio project for a simple football-viewing flow: find a match, choose a team, choose an anthem, set a cue point, start the match, and play the anthem when the supported team scores.

## Non-Negotiable Constraints

- The repository and primary demo must run for free and without API keys.
- Spotify and live football APIs are optional future integrations; do not implement them unless explicitly requested.
- Do not commit credentials, tokens, local audio files, generated secrets, or machine-specific files.
- Code, docs, UI copy, branches, commits, and issues must be in English.
- Keep the implementation production-quality but avoid enterprise scaffolding that is not exercised.

## Architecture Boundaries

- Use a modular monolith with vertical slices.
- `GoalAnthem.Domain` references nothing.
- `GoalAnthem.Application` may reference Domain.
- `GoalAnthem.Infrastructure` may reference Application and Domain.
- `GoalAnthem.Api` is the composition root.
- `GoalAnthem.Web` communicates with the backend only through public HTTP contracts.

## Backend Conventions

- Use ASP.NET Core, nullable C#, built-in DI, logging, and Problem Details.
- Use explicit domain types when they prevent invalid states.
- Use `CancellationToken` for asynchronous operations.
- Validate and map external data at boundaries.
- Do not add generic repositories, MediatR, or empty provider abstractions without a demonstrated need.

## Frontend Conventions

- Use React, TypeScript, Vite, strict TypeScript, and accessible responsive UI.
- Keep screens focused on the primary user flow.
- Include loading, empty, and error states for async data.
- Do not require Spotify, auth, environment variables, or paid services for the demo.

## Testing Requirements

- Add focused deterministic tests for domain invariants, application mapping, API behavior, architecture rules, and main frontend behavior.
- Prefer meaningful coverage over high test counts.
- Tests must not require network access, secrets, paid services, or local audio files.

## Git Workflow

- Work on feature branches named in English.
- Use Conventional Commits.
- Review diffs before committing and keep commits small and logical.
- Do not merge feature branches into `main` without explicit instruction.

## Definition Of Done

- Backend and frontend build.
- Relevant tests pass.
- Formatting, linting, and TypeScript checks pass.
- Documentation matches the implementation.
- No secrets or generated artifacts are committed.
- `git status` is clean except for intentional user-owned files.

## Required Commands Before Completion

- `dotnet format --verify-no-changes`
- `dotnet test`
- `npm ci --prefix src/GoalAnthem.Web`
- `npm run lint --prefix src/GoalAnthem.Web`
- `npm run typecheck --prefix src/GoalAnthem.Web`
- `npm run test --prefix src/GoalAnthem.Web`
- `npm run build --prefix src/GoalAnthem.Web`
