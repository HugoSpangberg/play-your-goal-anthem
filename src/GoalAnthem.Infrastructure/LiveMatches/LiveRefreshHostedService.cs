using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class LiveRefreshHostedService(
    AdaptiveMatchSessionService sessions,
    IEnumerable<ILiveMatchFeedProvider> providers,
    ConfiguredMatchProvider footballDataProvider,
    LiveProviderTelemetry telemetry,
    ILogger<LiveRefreshHostedService> logger,
    TimeProvider timeProvider)
    : IHostedService, IAsyncDisposable
{
    private readonly IReadOnlyList<ILiveMatchFeedProvider> sources = providers
        .Append(footballDataProvider)
        .DistinctBy(source => source.Name, StringComparer.Ordinal)
        .ToArray();
    private readonly Dictionary<string, DateTimeOffset> nextRun = new(StringComparer.Ordinal);
    private ITimer? timer;
    private int isRunning;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        foreach (var source in sources)
        {
            var dueAt = now + source.InitialDelay;
            nextRun[source.Name] = dueAt;
            telemetry.Initialize(source, dueAt);
        }

        timer = timeProvider.CreateTimer(
            _ => _ = RunOnceAsync(CancellationToken.None),
            null,
            TimeSpan.FromSeconds(1),
            TimeSpan.FromSeconds(1));
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        timer?.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (timer is not null)
        {
            await timer.DisposeAsync();
        }
    }

    internal async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        if (Interlocked.Exchange(ref isRunning, 1) == 1)
        {
            return;
        }

        try
        {
            await sessions.AdvanceAllAsync(cancellationToken);
            var activeSessions = sessions.GetActiveLiveTargets();
            if (activeSessions.Count == 0)
            {
                return;
            }

            var now = timeProvider.GetUtcNow();
            foreach (var source in sources)
            {
                if (!source.IsConfigured || nextRun.GetValueOrDefault(source.Name) > now)
                {
                    continue;
                }

                var scheduledNext = now + source.PollInterval;
                nextRun[source.Name] = scheduledNext;
                telemetry.MarkAttempt(source, now, scheduledNext);
                await ApplySourceAsync(source, activeSessions, now, cancellationToken);
            }
        }
        finally
        {
            Volatile.Write(ref isRunning, 0);
        }
    }

    private async Task ApplySourceAsync(
        ILiveMatchFeedProvider source,
        IReadOnlyList<LiveMatchTarget> activeSessions,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        try
        {
            var observations = await source.GetLiveMatchesAsync(cancellationToken);
            foreach (var observation in observations)
            {
                var session = ObservationSessionResolver.Resolve(activeSessions, observation);
                if (session is not null)
                {
                    await sessions.ApplyLiveObservationAsync(session.SessionId, observation, cancellationToken);
                }
            }

            var completedAt = timeProvider.GetUtcNow();
            telemetry.MarkSuccess(source, completedAt, nextRun[source.Name]);
        }
        catch (LiveProviderRateLimitException exception)
        {
            var retryAt = now + (exception.RetryAfter ?? TimeSpan.FromMinutes(2));
            nextRun[source.Name] = retryAt;
            telemetry.MarkFailure(source, now, retryAt, "rate-limited", exception.Message);
            logger.LogWarning("Provider {ProviderName} was rate-limited.", source.Name);
        }
        catch (LiveProviderQuotaExceededException exception)
        {
            var retryAt = now + TimeSpan.FromHours(6);
            nextRun[source.Name] = retryAt;
            telemetry.MarkFailure(source, now, retryAt, "quota-exhausted", exception.Message);
            logger.LogWarning("Provider {ProviderName} reached its safety budget.", source.Name);
        }
        catch (HttpRequestException exception)
        {
            var retryAt = now + TimeSpan.FromMinutes(2);
            nextRun[source.Name] = retryAt;
            telemetry.MarkFailure(source, now, retryAt, "degraded", exception.Message);
            logger.LogWarning(exception, "Provider {ProviderName} was temporarily unavailable.", source.Name);
        }
    }
}
