using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;

namespace GoalAnthem.Infrastructure.LiveMatches;

internal sealed class AdaptiveMatchSessionState
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

    private AdaptiveMatchSessionState(
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
        scenario = speed == "demo"
            ? DeterministicMatchScenario.Create(match).OrderBy(matchEvent => matchEvent.AtSecond).ToArray()
            : [];
        lastAdvancedAt = now;
        updatedAt = now;
    }

    public string SessionId { get; }
    public MatchDto Match { get; }
    public TeamDto SupportedTeam { get; }
    public string Speed { get; }

    public static AdaptiveMatchSessionState Create(CreateMatchSessionRequest request, DateTimeOffset now)
    {
        var supportedTeam = request.SupportedTeamId == request.Match.HomeTeam.Id
            ? request.Match.HomeTeam
            : request.Match.AwayTeam;
        return new AdaptiveMatchSessionState(
            $"session-{Guid.NewGuid():N}",
            request.Match,
            supportedTeam,
            request.Speed,
            now);
    }

    public AdaptiveSessionChanges AdvanceTo(DateTimeOffset now)
    {
        lock (gate)
        {
            if (status == "ended")
            {
                return AdaptiveSessionChanges.None;
            }

            var realSeconds = Math.Max(0, (int)Math.Floor((now - lastAdvancedAt).TotalSeconds));
            lastAdvancedAt = now;
            var multiplier = Speed == "demo" ? 15 : 1;
            return AdvanceLocked(elapsedSeconds + (realSeconds * multiplier), now);
        }
    }

    public AdaptiveSessionChanges ApplyObservation(LiveMatchObservation observation, DateTimeOffset now)
    {
        lock (gate)
        {
            if (status == "ended" || Speed != "normal")
            {
                return AdaptiveSessionChanges.None;
            }

            var events = new List<MatchSessionEventDto>();
            AddGoals(observation.HomeScore, true, observation.ElapsedSeconds, events);
            AddGoals(observation.AwayScore, false, observation.ElapsedSeconds, events);

            if (observation.ElapsedSeconds is { } observedSeconds)
            {
                elapsedSeconds = Math.Max(elapsedSeconds, observedSeconds);
            }

            ApplyStatus(observation.Status, events);
            updatedAt = now;
            var snapshot = ToSnapshotLocked();
            return new AdaptiveSessionChanges(events, snapshot, status == "ended" ? snapshot : null);
        }
    }

    public AdaptiveSessionChanges End(DateTimeOffset now)
    {
        lock (gate)
        {
            if (status == "ended")
            {
                return AdaptiveSessionChanges.None;
            }

            status = "ended";
            updatedAt = now;
            var snapshot = ToSnapshotLocked();
            return new AdaptiveSessionChanges([], snapshot, snapshot);
        }
    }

    public MatchSessionSnapshotDto ToSnapshot()
    {
        lock (gate)
        {
            return ToSnapshotLocked();
        }
    }

    public LiveMatchTarget? ToLiveTarget()
    {
        lock (gate)
        {
            return status != "ended" && Speed == "normal"
                ? new LiveMatchTarget(SessionId, Match)
                : null;
        }
    }

    public bool IsExpired(DateTimeOffset now, TimeSpan retention)
    {
        lock (gate)
        {
            return status == "ended" && now - updatedAt >= retention;
        }
    }

    private AdaptiveSessionChanges AdvanceLocked(int targetElapsedSeconds, DateTimeOffset now)
    {
        var events = new List<MatchSessionEventDto>();
        foreach (var scenarioEvent in scenario)
        {
            if (scenarioEvent.AtSecond > targetElapsedSeconds || !processedEventIds.Add(scenarioEvent.Id))
            {
                continue;
            }

            elapsedSeconds = Math.Max(elapsedSeconds, scenarioEvent.AtSecond);
            var processedEvent = ApplyScenarioEvent(scenarioEvent);
            timeline.Add(processedEvent);
            events.Add(processedEvent);
        }

        elapsedSeconds = Math.Max(elapsedSeconds, targetElapsedSeconds);
        updatedAt = now;
        var snapshot = ToSnapshotLocked();
        var endedSnapshot = status == "ended" && events.Any(matchEvent => matchEvent.Type == "full-time")
            ? snapshot
            : null;
        return new AdaptiveSessionChanges(events, snapshot, endedSnapshot);
    }

    private void AddGoals(
        int observedScore,
        bool isHome,
        int? observedSeconds,
        ICollection<MatchSessionEventDto> events)
    {
        var currentScore = isHome ? homeScore : awayScore;
        var targetScore = Math.Max(currentScore, observedScore);
        var team = isHome ? Match.HomeTeam : Match.AwayTeam;

        while (currentScore < targetScore)
        {
            currentScore += 1;
            if (isHome)
            {
                homeScore = currentScore;
            }
            else
            {
                awayScore = currentScore;
            }

            var eventId = $"live:{SessionId}:{(isHome ? "home" : "away")}:{currentScore}";
            if (!processedEventIds.Add(eventId))
            {
                continue;
            }

            var matchEvent = new MatchSessionEventDto(
                eventId,
                Math.Max(0, observedSeconds ?? elapsedSeconds),
                "goal",
                $"{team.Name} goal",
                team.Id,
                homeScore,
                awayScore);
            timeline.Add(matchEvent);
            events.Add(matchEvent);
        }
    }

    private void ApplyStatus(string observedStatus, ICollection<MatchSessionEventDto> events)
    {
        if (observedStatus == "half-time" && status != "half-time")
        {
            status = "half-time";
            AddStatusEvent("half-time", "Half-time", events);
            return;
        }

        if (observedStatus == "live")
        {
            if (status == "half-time")
            {
                AddStatusEvent("second-half", "Second half", events);
            }

            status = "live";
            return;
        }

        if (observedStatus == "ended" && status != "ended")
        {
            status = "ended";
            AddStatusEvent("full-time", "Full time", events);
        }
    }

    private void AddStatusEvent(string type, string label, ICollection<MatchSessionEventDto> events)
    {
        var eventId = $"live:{SessionId}:{type}";
        if (!processedEventIds.Add(eventId))
        {
            return;
        }

        var matchEvent = new MatchSessionEventDto(
            eventId,
            elapsedSeconds,
            type,
            label,
            null,
            homeScore,
            awayScore);
        timeline.Add(matchEvent);
        events.Add(matchEvent);
    }

    private MatchSessionEventDto ApplyScenarioEvent(DeterministicMatchEvent matchEvent)
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

internal sealed record AdaptiveSessionChanges(
    IReadOnlyList<MatchSessionEventDto> Events,
    MatchSessionSnapshotDto? Snapshot,
    MatchSessionSnapshotDto? EndedSnapshot)
{
    public static AdaptiveSessionChanges None { get; } = new([], null, null);
}
