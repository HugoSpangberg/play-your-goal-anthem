using GoalAnthem.Application.Matches.GetMatches;

namespace GoalAnthem.Application.MatchSessions;

public sealed record CreateMatchSessionRequest(
    MatchDto Match,
    string SupportedTeamId,
    string Speed);

public sealed record CreateMatchSessionResponse(string SessionId, MatchSessionSnapshotDto Snapshot);

public sealed record MatchSessionSnapshotDto(
    string SessionId,
    MatchDto Match,
    TeamDto SupportedTeam,
    string Speed,
    int ElapsedSeconds,
    int HomeScore,
    int AwayScore,
    string Status,
    IReadOnlyList<MatchSessionEventDto> Timeline,
    DateTimeOffset UpdatedAt);

public sealed record MatchSessionEventDto(
    string Id,
    int AtSecond,
    string Type,
    string Label,
    string? TeamId,
    int HomeScore,
    int AwayScore);

public interface IMatchSessionService
{
    Task<CreateMatchSessionResponse> CreateAsync(CreateMatchSessionRequest request, CancellationToken cancellationToken);

    Task<MatchSessionSnapshotDto> GetSnapshotAsync(string sessionId, CancellationToken cancellationToken);

    Task<MatchSessionSnapshotDto> EndAsync(string sessionId, CancellationToken cancellationToken);
}

public interface IMatchSessionNotifier
{
    Task SnapshotUpdatedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken);

    Task EventProcessedAsync(string sessionId, MatchSessionEventDto matchEvent, CancellationToken cancellationToken);

    Task SessionEndedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken);
}

public sealed class NoOpMatchSessionNotifier : IMatchSessionNotifier
{
    public Task SnapshotUpdatedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task EventProcessedAsync(string sessionId, MatchSessionEventDto matchEvent, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task SessionEndedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class MatchSessionProblemException(string title, int statusCode, string detail) : Exception(detail)
{
    public string Title { get; } = title;

    public int StatusCode { get; } = statusCode;
}
