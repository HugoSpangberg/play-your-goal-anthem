## Summary

Describe the change and why it was made.

## Verification

- [ ] `dotnet format GoalAnthem.sln --verify-no-changes`
- [ ] `dotnet test GoalAnthem.sln`
- [ ] `npm ci --prefix src/GoalAnthem.Web`
- [ ] `npm run lint --prefix src/GoalAnthem.Web`
- [ ] `npm run typecheck --prefix src/GoalAnthem.Web`
- [ ] `npm run test --prefix src/GoalAnthem.Web`
- [ ] `npm run build --prefix src/GoalAnthem.Web`
