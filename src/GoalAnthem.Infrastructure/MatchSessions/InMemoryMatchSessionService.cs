using System.Collections.Concurrent;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GoalAnthem.Infrastructure.MatchSessions;

public sealed class InMemoryMatchSessionService(
    IMatchSessionNotifier notifier,
    ILogger<InMemoryMatchSessionService> logger,
    TimeProvider timeProvider)
    : IMatchSessionService
{
    private static readonly TimeSpan EndedSessionRetention = TimeSpan.FromMinutes(20);
    private readonly ConcurrentDictionary<string, MatchSessionState> sessions = new(StringComparer.Ordinal);

    public async Task<CreateMatchSessionResponse> CreateAsync(CreateMatchSessionRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        Validate(request);

        var now = timeProvider.GetUtcNow();
        var session = MatchSessionState.Create(request, now);
        if (!sessions.TryAdd(session.SessionId, session))
        {
            throw new MatchSessionProblemException("Session conflict", 409, "A match session could not be created.");
        }

        var changes = session.AdvanceTo(now);
        logger.LogInformation("Created match session {SessionId} for match {MatchId}.", session.SessionId, request.Match.Id);
        await PublishAsync(session.SessionId, changes, cancellationToken);

        return new CreateMatchSessionResponse(session.SessionId, session.ToSnapshot());
    }

    public Task<MatchSessionSnapshotDto> GetSnapshotAsync(string sessionId, CancellationToken cancellationToken)
    {
        var session = GetExisting(sessionId);
        return Task.FromResult(session.ToSnapshot());
    }

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
            var changes = session.AdvanceTo(now);
            await PublishAsync(session.SessionId, changes, cancellationToken);
        }

        CleanupExpired(now);
    }

    private void CleanupExpired(DateTimeOffset now)
    {
        foreach (var session in sessions.Values)
        {
            if (session.IsExpired(now, EndedSessionRetention) && sessions.TryRemove(session.SessionId, out _))
            {
                logger.LogInformation("Expired match session {SessionId}.", session.SessionId);
            }
        }
    }

    private MatchSessionState GetExisting(string sessionId)
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

    private async Task PublishAsync(string sessionId, SessionChanges changes, CancellationToken cancellationToken)
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

    private sealed class MatchSessionState
    {
        private readonly object gate = new();
        private readonly IReadOnlyList<DeterministicMatchEvent> scenario;
        private readonly HashSet<string> processedEventIds = new(StringComparer.Ordinal);
        private readonly List<MatchSessionEventDto> timeline = [];
        private int awayScore;
        private int elapsedSeconds;
        private int homeScore;
        private DateTimeOffset lastAdvancedAt;
        private DateTimeOffset updatedAt;
        private string status = "live";

        private MatchSessionState(
            string sessionId,
            MatchDto match,
            TeamDto supportedTeam,
            string speed,
            DateTimeOffset now)
        {
            SessionId = sessionId;
            Match = match;
            SupportedTeam = supportedTeam;
            Speed = speed;
            scenario = DeterministicMatchScenario.Create(match).OrderBy(matchEvent => matchEvent.AtSecond).ToArray();
            lastAdvancedAt = now;
            updatedAt = now;
        }

        public string SessionId { get; }

        public MatchDto Match { get; }

        public TeamDto SupportedTeam { get; }

        public string Speed { get; }

        public static MatchSessionState Create(CreateMatchSessionRequest request, DateTimeOffset now)
        {
            var supportedTeam = request.SupportedTeamId == request.Match.HomeTeam.Id ? request.Match.HomeTeam : request.Match.AwayTeam;
            return new MatchSessionState(
                $"session-{Guid.NewGuid():N}",
                request.Match,
                supportedTeam,
                request.Speed,
                now);
        }

        public SessionChanges AdvanceTo(DateTimeOffset now)
        {
            lock (gate)
            {
                if (status == "ended")
                {
                    return SessionChanges.None;
                }

                var realSeconds = Math.Max(0, (int)Math.Floor((now - lastAdvancedAt).TotalSeconds));
                var targetElapsedSeconds = elapsedSeconds + (realSeconds * SecondsPerRealSecond);
                lastAdvancedAt = now;

                return AdvanceLocked(targetElapsedSeconds, now);
            }
        }

        public SessionChanges End(DateTimeOffset now)
        {
            lock (gate)
            {
                if (status == "ended")
                {
                    return SessionChanges.None;
                }

                status = "ended";
                updatedAt = now;
                var snapshot = ToSnapshotLocked();
                return new SessionChanges([], snapshot, snapshot);
            }
        }

        public MatchSessionSnapshotDto ToSnapshot()
        {
            lock (gate)
            {
                return ToSnapshotLocked();
            }
        }

        public bool IsExpired(DateTimeOffset now, TimeSpan retention)
        {
            lock (gate)
            {
                return status == "ended" && now - updatedAt >= retention;
            }
        }

        private int SecondsPerRealSecond => Speed == "demo" ? 15 : 1;

        private SessionChanges AdvanceLocked(int targetElapsedSeconds, DateTimeOffset now)
        {
            var processed = new List<MatchSessionEventDto>();
            foreach (var matchEvent in scenario)
            {
                if (matchEvent.AtSecond > targetElapsedSeconds || processedEventIds.Contains(matchEvent.Id))
                {
                    continue;
                }

                processedEventIds.Add(matchEvent.Id);
                elapsedSeconds = Math.Max(elapsedSeconds, matchEvent.AtSecond);
                var processedEvent = ApplyEvent(matchEvent);
                timeline.Add(processedEvent);
                processed.Add(processedEvent);
            }

            elapsedSeconds = Math.Max(elapsedSeconds, targetElapsedSeconds);
            updatedAt = now;

            var snapshot = ToSnapshotLocked();
            var endedSnapshot = status == "ended" && processed.Any(matchEvent => matchEvent.Type == "full-time") ? snapshot : null;
            return new SessionChanges(processed, snapshot, endedSnapshot);
        }

        private MatchSessionEventDto ApplyEvent(DeterministicMatchEvent matchEvent)
        {
            if (matchEvent.Type == "goal")
            {
                if (matchEvent.TeamId == Match.HomeTeam.Id)
                {
                    homeScore += 1;
                }

                if (matchEvent.TeamId == Match.AwayTeam.Id)
                {
                    awayScore += 1;
                }
            }

            status = matchEvent.Type switch
            {
                "half-time" => "half-time",
                "second-half" => "live",
                "full-time" => "ended",
                _ => status,
            };

            return new MatchSessionEventDto(
                matchEvent.Id,
                matchEvent.AtSecond,
                matchEvent.Type,
                matchEvent.Label,
                matchEvent.TeamId,
                homeScore,
                awayScore);
        }

        private MatchSessionSnapshotDto ToSnapshotLocked() =>
            new(
                SessionId,
                Match,
                SupportedTeam,
                Speed,
                elapsedSeconds,
                homeScore,
                awayScore,
                status,
                timeline.ToArray(),
                updatedAt);
    }

    private sealed record SessionChanges(
        IReadOnlyList<MatchSessionEventDto> Events,
        MatchSessionSnapshotDto? Snapshot,
        MatchSessionSnapshotDto? EndedSnapshot)
    {
        public static SessionChanges None { get; } = new([], null, null);
    }
}

public sealed class MatchSessionWorker(
    InMemoryMatchSessionService sessions,
    ILogger<MatchSessionWorker> logger,
    TimeProvider timeProvider)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1), timeProvider);
        logger.LogInformation("Match session worker started.");

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await sessions.AdvanceAllAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Match session worker stopped.");
        }
    }
}
