namespace GoalAnthem.Application.Matches.GetMatches;

public sealed record MatchesResponseDto(
    IReadOnlyList<MatchDto> Matches,
    string Source,
    DateTimeOffset FetchedAt,
    bool IsFallback,
    string? Message);
