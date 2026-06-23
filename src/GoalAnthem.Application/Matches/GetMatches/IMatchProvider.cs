using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Matches.GetMatches;

public interface IMatchProvider
{
    Task<MatchProviderResult> GetMatchesAsync(MatchProviderRequest request, CancellationToken cancellationToken);
}

public sealed record MatchProviderRequest(bool ForceRefresh);

public sealed record MatchProviderResult(
    IReadOnlyList<DemoMatch> Matches,
    MatchDataSource Source,
    DateTimeOffset FetchedAt,
    bool IsFallback,
    string? Message);

public enum MatchDataSource
{
    Demo,
    LiveWorldCup
}
