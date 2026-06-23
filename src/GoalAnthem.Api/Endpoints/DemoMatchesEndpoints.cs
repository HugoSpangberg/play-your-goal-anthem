using GoalAnthem.Application.Matches.GetDemoMatches;

namespace GoalAnthem.Api.Endpoints;

public static class DemoMatchesEndpoints
{
    public static IEndpointRouteBuilder MapDemoMatchesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/demo-matches", async (
                GetDemoMatchesHandler handler,
                CancellationToken cancellationToken) =>
            {
                var matches = await handler.HandleAsync(new GetDemoMatchesQuery(), cancellationToken);
                return Results.Ok(matches);
            })
            .WithName("GetDemoMatches")
            .WithSummary("Get deterministic demo matches")
            .WithDescription("Returns stable, version-controlled demo matches for the free local GoalAnthem experience.")
            .Produces<IReadOnlyList<DemoMatchDto>>();

        return app;
    }
}
