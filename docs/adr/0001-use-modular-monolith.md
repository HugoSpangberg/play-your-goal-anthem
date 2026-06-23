# ADR 0001: Use A Modular Monolith

## Status

Accepted

## Context

GoalAnthem needs clear boundaries but does not need independent deployment, distributed messaging, or service-level scaling. The repository is a portfolio project and should be easy to understand and run locally.

## Decision

Use a modular monolith backend split into Domain, Application, Infrastructure, and API projects.

## Consequences

- Dependency direction is simple and testable.
- The API remains the composition root.
- External integrations can be isolated behind infrastructure adapters when they are implemented.
- The project avoids microservice operational complexity that the product does not need.
