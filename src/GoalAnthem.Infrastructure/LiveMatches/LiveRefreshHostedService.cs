using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class LiveRefreshHostedService(
    AdaptiveMatchSessionService sessions,
    IEnumerable<ILiveMatchFeedProvider> providers,
    ConfiguredMatchProvider footballDataProvider,
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
            nextRun[source.Name] = now + source.InitialDelay;
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

                nextRun[source.Name] = now + source.PollInterval;
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
        }
        catch (LiveProviderRateLimitException exception)
        {
            nextRun[source.Name] = now + (exception.RetryAfter ?? TimeSpan.FromMinutes(2));
            logger.LogWarning("Provider {ProviderName} was rate-limited.", source.Name);
        }
        catch (LiveProviderQuotaExceededException)
        {
            nextRun[source.Name] = now + TimeSpan.FromHours(6);
            logger.LogWarning("Provider {ProviderName} reached its safety budget.", source.Name);
        }
        catch (HttpRequestException exception)
        {
            nextRun[source.Name] = now + TimeSpan.FromMinutes(2);
            logger.LogWarning(exception, "Provider {ProviderName} was temporarily unavailable.", source.Name);
        }
    }
}
