using GoalAnthem.Application.MatchSessions;
using Microsoft.AspNetCore.SignalR;

namespace GoalAnthem.Api.Hubs;

public interface IMatchSessionClient
{
    Task SnapshotUpdated(MatchSessionSnapshotDto snapshot);

    Task EventProcessed(MatchSessionEventDto matchEvent);

    Task SessionEnded(MatchSessionSnapshotDto snapshot);
}

public sealed class MatchSessionHub(IMatchSessionService sessions, ILogger<MatchSessionHub> logger)
    : Hub<IMatchSessionClient>
{
    public async Task<MatchSessionSnapshotDto> JoinSession(string sessionId)
    {
        try
        {
            var snapshot = await sessions.GetSnapshotAsync(sessionId, Context.ConnectionAborted);
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(sessionId), Context.ConnectionAborted);
            logger.LogInformation("SignalR connection {ConnectionId} joined match session {SessionId}.", Context.ConnectionId, sessionId);
            await Clients.Caller.SnapshotUpdated(snapshot);
            return snapshot;
        }
        catch (MatchSessionProblemException exception)
        {
            throw new HubException(exception.Message);
        }
    }

    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(sessionId), Context.ConnectionAborted);
        logger.LogInformation("SignalR connection {ConnectionId} left match session {SessionId}.", Context.ConnectionId, sessionId);
    }

    public static string GroupName(string sessionId) => $"match-session:{sessionId}";
}
