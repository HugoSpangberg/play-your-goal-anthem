using GoalAnthem.Application.MatchSessions;
using Microsoft.AspNetCore.SignalR;

namespace GoalAnthem.Api.Hubs;

public sealed class SignalRMatchSessionNotifier(IHubContext<MatchSessionHub, IMatchSessionClient> hubContext)
    : IMatchSessionNotifier
{
    public Task SnapshotUpdatedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) =>
        hubContext.Clients.Group(MatchSessionHub.GroupName(sessionId)).SnapshotUpdated(snapshot);

    public Task EventProcessedAsync(string sessionId, MatchSessionEventDto matchEvent, CancellationToken cancellationToken) =>
        hubContext.Clients.Group(MatchSessionHub.GroupName(sessionId)).EventProcessed(matchEvent);

    public Task SessionEndedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) =>
        hubContext.Clients.Group(MatchSessionHub.GroupName(sessionId)).SessionEnded(snapshot);
}
