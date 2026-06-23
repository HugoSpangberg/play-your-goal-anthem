namespace GoalAnthem.Application.Matches.GetMatches;

public sealed record MatchDto(
    string Id,
    DateTimeOffset KickoffTime,
    string Status,
    TeamDto HomeTeam,
    TeamDto AwayTeam);
