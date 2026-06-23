using GoalAnthem.Application.Matches.GetMatches;

namespace GoalAnthem.Application.MatchSessions;

public static class DeterministicMatchScenario
{
    private static readonly int Minute = 60;

    public static IReadOnlyList<DeterministicMatchEvent> Create(MatchDto match) =>
        [
            new($"{match.Id}-kickoff", 0, "kickoff", "Kickoff", null),
            new($"{match.Id}-home-goal-1", 14 * Minute, "goal", $"{match.HomeTeam.Name} goal", match.HomeTeam.Id),
            new($"{match.Id}-half-time", 45 * Minute, "half-time", "Half-time", null),
            new($"{match.Id}-second-half", 46 * Minute, "second-half", "Second half", null),
            new($"{match.Id}-away-goal-1", 66 * Minute, "goal", $"{match.AwayTeam.Name} goal", match.AwayTeam.Id),
            new($"{match.Id}-home-goal-2", 82 * Minute, "goal", $"{match.HomeTeam.Name} goal", match.HomeTeam.Id),
            new($"{match.Id}-full-time", 90 * Minute, "full-time", "Full-time", null),
        ];
}

public sealed record DeterministicMatchEvent(
    string Id,
    int AtSecond,
    string Type,
    string Label,
    string? TeamId);
