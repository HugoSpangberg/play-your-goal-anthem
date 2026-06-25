using System.Collections.Concurrent;
using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Infrastructure.Matches;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class LiveProviderTelemetry(
    IEnumerable<ILiveMatchFeedProvider> providers,
    ConfiguredMatchProvider footballDataProvider,
    TimeProvider timeProvider)
    : ILiveProviderHealthReader
{
    private readonly IReadOnlyList<ILiveMatchFeedProvider> sources = providers
        .Append(footballDataProvider)
        .DistinctBy(source => source.Name, StringComparer.Ordinal)
        .ToArray();
    private readonly ConcurrentDictionary<string, TelemetryState> states = new(StringComparer.Ordinal);

    public IReadOnlyList<LiveProviderHealthDto> GetHealth()
    {
        var now = timeProvider.GetUtcNow();
        return sources
            .Select(source =>
            {
                var state = states.GetOrAdd(source.Name, _ => TelemetryState.Create(now + source.InitialDelay));
                return new LiveProviderHealthDto(
                    source.Name,
                    source.IsConfigured,
                    source.IsConfigured ? state.Status : "not-configured",
                    (int)source.PollInterval.TotalSeconds,
                    state.LastAttemptAt,
                    state.LastSuccessAt,
                    state.NextRunAt,
                    state.BackoffUntil,
                    state.LastFailure,
                    source.RequestsUsedToday,
                    source.RequestsRemainingToday);
            })
            .OrderBy(item => item.Name, StringComparer.Ordinal)
            .ToArray();
    }

    public void Initialize(ILiveMatchFeedProvider source, DateTimeOffset nextRunAt) =>
        states.TryAdd(source.Name, TelemetryState.Create(nextRunAt));

    public void MarkAttempt(ILiveMatchFeedProvider source, DateTimeOffset attemptedAt, DateTimeOffset nextRunAt) =>
        states.AddOrUpdate(
            source.Name,
            _ => TelemetryState.Create(nextRunAt) with { Status = "refreshing", LastAttemptAt = attemptedAt },
            (_, current) => current with { Status = "refreshing", LastAttemptAt = attemptedAt, NextRunAt = nextRunAt });

    public void MarkSuccess(ILiveMatchFeedProvider source, DateTimeOffset completedAt, DateTimeOffset nextRunAt) =>
        states.AddOrUpdate(
            source.Name,
            _ => TelemetryState.Create(nextRunAt) with { Status = "healthy", LastSuccessAt = completedAt },
            (_, current) => current with
            {
                Status = "healthy",
                LastSuccessAt = completedAt,
                NextRunAt = nextRunAt,
                BackoffUntil = null,
                LastFailure = null,
            });

    public void MarkFailure(
        ILiveMatchFeedProvider source,
        DateTimeOffset attemptedAt,
        DateTimeOffset retryAt,
        string status,
        string failure) =>
        states.AddOrUpdate(
            source.Name,
            _ => TelemetryState.Create(retryAt) with
            {
                Status = status,
                LastAttemptAt = attemptedAt,
                BackoffUntil = retryAt,
                LastFailure = failure,
            },
            (_, current) => current with
            {
                Status = status,
                LastAttemptAt = attemptedAt,
                NextRunAt = retryAt,
                BackoffUntil = retryAt,
                LastFailure = failure,
            });

    private sealed record TelemetryState(
        string Status,
        DateTimeOffset? LastAttemptAt,
        DateTimeOffset? LastSuccessAt,
        DateTimeOffset NextRunAt,
        DateTimeOffset? BackoffUntil,
        string? LastFailure)
    {
        public static TelemetryState Create(DateTimeOffset nextRunAt) =>
            new("idle", null, null, nextRunAt, null, null);
    }
}
