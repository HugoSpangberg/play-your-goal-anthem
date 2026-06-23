namespace GoalAnthem.Application.Matches.GetDemoMatches;

public sealed record DemoMatchDto(
    string Id,
    DateTimeOffset KickoffTime,
    string Status,
    TeamDto HomeTeam,
    TeamDto AwayTeam);
