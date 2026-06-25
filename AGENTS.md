# Play Your Goal Anthem Instructions

## Product Purpose

Play Your Goal Anthem is a portfolio project for a simple football-viewing flow that works without API keys or paid services.

Primary flow:

Find match -> Choose team -> Choose anthem -> Set cue point -> Start match -> Play anthem when the supported team scores.

## Architecture Rules

- Use a modular monolith with vertical slices.
- `GoalAnthem.Domain` references nothing.
- `GoalAnthem.Application` may reference Domain.
- `GoalAnthem.Infrastructure` may reference Application and Domain.
- `GoalAnthem.Api` is the composition root.
- `GoalAnthem.Web` communicates with the backend only through public HTTP contracts.
- Do not introduce unnecessary abstractions, generic repositories, MediatR, or placeholder provider layers.

## Backend Conventions

- Use ASP.NET Core, nullable C#, built-in DI, logging, and Problem Details.
- Use explicit domain types when they prevent invalid states.
- Use `CancellationToken` in asynchronous flows.
- Validate and map external or file-backed data at boundaries.
- Keep live football data and any other external providers behind explicit boundaries and only add them when the feature requires it.

## Frontend Conventions

- Use React, TypeScript, Vite, and strict TypeScript settings.
- Keep the user flow focused, responsive, and self-explanatory.
- Include loading, empty, and error states for async UI.
- Prefer local explicit state for setup flow over router or global state unless a real need appears.
- Do not add new runtime dependencies without clear product value.

## Accessibility

- All interactive controls must be keyboard accessible.
- Selected and completed states must be clear without relying only on color.
- Use semantic headings, labels, and ARIA only where they improve clarity.

## Safety And Assets

- Never commit secrets, tokens, machine-specific settings, or generated credentials.
- Do not commit copyrighted audio or bundled music files.
- The main demo must remain usable without accounts, paid music services, or external football APIs.

## Testing And Verification

Run these before completion:

- `dotnet format GoalAnthem.sln --verify-no-changes`
- `dotnet test GoalAnthem.sln`
- `npm ci --prefix src/GoalAnthem.Web`
- `npm run lint --prefix src/GoalAnthem.Web`
- `npm run typecheck --prefix src/GoalAnthem.Web`
- `npm run test --prefix src/GoalAnthem.Web`
- `npm run build --prefix src/GoalAnthem.Web`

## Git Workflow

- Work on English-named feature branches.
- Use small Conventional Commits.
- Open pull requests into `main`.
- Do not commit directly to `main`.
- Do not merge without explicit instruction.
