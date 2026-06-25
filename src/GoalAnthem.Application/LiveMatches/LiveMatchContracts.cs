using GoalAnthem.Application.Matches.GetMatches;

namespace GoalAnthem.Application.LiveMatches;

public sealed record LiveMatchObservation(
    string Provider,
    string ProviderMatchId,
    DateTimeOffset KickoffTime,
    DateTimeOffset ObservedAt,
    string HomeTeamName,
    string AwayTeamName,
    string? HomeCountryCode,
    string? AwayCountryCode,
    int HomeScore,
    int AwayScore,
    string Status,
    int? ElapsedSeconds);

public sealed record LiveMatchTarget(string SessionId, MatchDto Match);

public sealed record LiveProviderHealthDto(
    string Name,
    bool Configured,
    string State,
    int PollIntervalSeconds,
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset? LastSuccessAt,
    DateTimeOffset? NextPollAt,
    DateTimeOffset? BackoffUntil,
    string? LastFailure,
    int? RequestsUsedToday,
    int? RequestsRemainingToday);

public interface ILiveMatchFeedProvider
{
    string Name { get; }

    bool IsConfigured { get; }

    TimeSpan PollInterval { get; }

    TimeSpan InitialDelay { get; }

    int? RequestsUsedToday { get; }

    int? RequestsRemainingToday { get; }

    Task<IReadOnlyList<LiveMatchObservation>> GetLiveMatchesAsync(CancellationToken cancellationToken);
}

public interface ILiveMatchObservationSink
{
    IReadOnlyList<LiveMatchTarget> GetActiveLiveTargets();

    Task ApplyLiveObservationAsync(string sessionId, LiveMatchObservation observation, CancellationToken cancellationToken);
}

public interface ILiveProviderHealthReader
{
    IReadOnlyList<LiveProviderHealthDto> GetHealth();
}

public sealed class LiveProviderRateLimitException(TimeSpan? retryAfter = null)
    : Exception("The live provider rate limit was reached.")
{
    public TimeSpan? RetryAfter { get; } = retryAfter;
}

public sealed class LiveProviderQuotaExceededException(string message) : Exception(message);
