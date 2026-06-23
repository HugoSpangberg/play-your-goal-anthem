namespace GoalAnthem.Application.Matches.GetMatches;

public interface IMatchProviderHealthReader
{
    MatchProviderHealth GetHealth();
}

public sealed record MatchProviderHealth(
    bool LiveProviderConfigured,
    string ActiveSource,
    DateTimeOffset? LastSuccessfulFetch,
    DateTimeOffset? LastFailedFetch,
    string? LastFailure);
