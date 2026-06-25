using System.Collections.Concurrent;
using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.MatchSessions;
using Microsoft.Extensions.Logging;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class AdaptiveMatchSessionService(
    IMatchSessionNotifier notifier,
    ILogger<AdaptiveMatchSessionService> logger,
    TimeProvider timeProvider)
    : IMatchSessionService, ILiveMatchObservationSink
{
    private static readonly TimeSpan EndedSessionRetention = TimeSpan.FromMinutes(20);
    private readonly ConcurrentDictionary<string, AdaptiveMatchSessionState> sessions = new(StringComparer.Ordinal);

    public async Task<CreateMatchSessionResponse> CreateAsync(CreateMatchSessionRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        Validate(request);

        var now = timeProvider.GetUtcNow();
        var session = AdaptiveMatchSessionState.Create(request, now);
        if (!sessions.TryAdd(session.SessionId, session))
        {
            throw new MatchSessionProblemException("Session conflict", 409, "A match session could not be created.");
        }

        var changes = session.AdvanceTo(now);
        logger.LogInformation(
            "Created {Speed} match session {SessionId} for match {MatchId}.",
            request.Speed,
            session.SessionId,
            request.Match.Id);
        await PublishAsync(session.SessionId, changes, cancellationToken);
        return new CreateMatchSessionResponse(session.SessionId, session.ToSnapshot());
    }

    public Task<MatchSessionSnapshotDto> GetSnapshotAsync(string sessionId, CancellationToken cancellationToken) =>
        Task.FromResult(GetExisting(sessionId).ToSnapshot());

    public async Task<MatchSessionSnapshotDto> EndAsync(string sessionId, CancellationToken cancellationToken)
    {
        var session = GetExisting(sessionId);
        var changes = session.End(timeProvider.GetUtcNow());
        await PublishAsync(session.SessionId, changes, cancellationToken);
        return session.ToSnapshot();
    }

    public async Task AdvanceAllAsync(CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        foreach (var session in sessions.Values)
        {
            await PublishAsync(session.SessionId, session.AdvanceTo(now), cancellationToken);
        }

        foreach (var session in sessions.Values)
        {
            if (session.IsExpired(now, EndedSessionRetention) && sessions.TryRemove(session.SessionId, out _))
            {
                logger.LogInformation("Expired match session {SessionId}.", session.SessionId);
            }
        }
    }

    public IReadOnlyList<LiveMatchTarget> GetActiveLiveTargets() =>
        sessions.Values
            .Select(session => session.ToLiveTarget())
            .Where(target => target is not null)
            .Cast<LiveMatchTarget>()
            .ToArray();

    public async Task ApplyLiveObservationAsync(
        string sessionId,
        LiveMatchObservation observation,
        CancellationToken cancellationToken)
    {
        var session = GetExisting(sessionId);
        var changes = session.ApplyObservation(observation, timeProvider.GetUtcNow());

        if (changes.Events.Count > 0)
        {
            logger.LogInformation(
                "Accepted {EventCount} events from {ProviderName} for session {SessionId}.",
                changes.Events.Count,
                observation.Provider,
                sessionId);
        }

        await PublishAsync(sessionId, changes, cancellationToken);
    }

    private AdaptiveMatchSessionState GetExisting(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || !sessions.TryGetValue(sessionId, out var session))
        {
            throw new MatchSessionProblemException("Match session not found", 404, "The match session does not exist or has expired.");
        }

        return session;
    }

    private static void Validate(CreateMatchSessionRequest request)
    {
        if (request.Match is null)
        {
            throw new MatchSessionProblemException("Invalid match session", 400, "Match metadata is required.");
        }

        if (request.Speed is not ("normal" or "demo"))
        {
            throw new MatchSessionProblemException("Invalid match speed", 400, "Match speed must be normal or demo.");
        }

        if (request.SupportedTeamId != request.Match.HomeTeam.Id && request.SupportedTeamId != request.Match.AwayTeam.Id)
        {
            throw new MatchSessionProblemException("Invalid supported team", 400, "The supported team must belong to the selected match.");
        }
    }

    private async Task PublishAsync(
        string sessionId,
        AdaptiveSessionChanges changes,
        CancellationToken cancellationToken)
    {
        foreach (var matchEvent in changes.Events)
        {
            await notifier.EventProcessedAsync(sessionId, matchEvent, cancellationToken);
        }

        if (changes.Snapshot is not null)
        {
            await notifier.SnapshotUpdatedAsync(sessionId, changes.Snapshot, cancellationToken);
        }

        if (changes.EndedSnapshot is not null)
        {
            await notifier.SessionEndedAsync(sessionId, changes.EndedSnapshot, cancellationToken);
        }
    }
}
