using GoalAnthem.Api.Hubs;
using GoalAnthem.Application.MatchSessions;

namespace GoalAnthem.Api.Endpoints;

public static class MatchSessionEndpoints
{
    public static IEndpointRouteBuilder MapMatchSessionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/match-sessions", async (
                CreateMatchSessionRequest request,
                IMatchSessionService sessions,
                CancellationToken cancellationToken) =>
            {
                try
                {
                    return Results.Ok(await sessions.CreateAsync(request, cancellationToken));
                }
                catch (MatchSessionProblemException exception)
                {
                    return Problem(exception);
                }
            })
            .WithName("CreateMatchSession")
            .WithSummary("Create a backend-owned deterministic match session")
            .Produces<CreateMatchSessionResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);

        app.MapGet("/api/match-sessions/{sessionId}", async (
                string sessionId,
                IMatchSessionService sessions,
                CancellationToken cancellationToken) =>
            {
                try
                {
                    return Results.Ok(await sessions.GetSnapshotAsync(sessionId, cancellationToken));
                }
                catch (MatchSessionProblemException exception)
                {
                    return Problem(exception);
                }
            })
            .WithName("GetMatchSession")
            .WithSummary("Get the latest authoritative match-session snapshot")
            .Produces<MatchSessionSnapshotDto>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        app.MapPost("/api/match-sessions/{sessionId}/end", async (
                string sessionId,
                IMatchSessionService sessions,
                CancellationToken cancellationToken) =>
            {
                try
                {
                    return Results.Ok(await sessions.EndAsync(sessionId, cancellationToken));
                }
                catch (MatchSessionProblemException exception)
                {
                    return Problem(exception);
                }
            })
            .WithName("EndMatchSession")
            .WithSummary("End a match session idempotently")
            .Produces<MatchSessionSnapshotDto>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        app.MapHub<MatchSessionHub>("/hubs/matches");

        return app;
    }

    private static IResult Problem(MatchSessionProblemException exception) =>
        Results.Problem(
            title: exception.Title,
            detail: exception.Message,
            statusCode: exception.StatusCode);
}
