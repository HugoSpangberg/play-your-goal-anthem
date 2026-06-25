using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;

namespace GoalAnthem.Api.Endpoints;

public static class DemoMatchesEndpoints
{
    public static IEndpointRouteBuilder MapDemoMatchesEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/matches", async (
                bool? refresh,
                GetMatchesHandler handler,
                CancellationToken cancellationToken) =>
            {
                var response = await handler.HandleAsync(new GetMatchesQuery(refresh == true), cancellationToken);
                return Results.Ok(response);
            })
            .WithName("GetMatches")
            .WithSummary("Get selectable matches")
            .WithDescription("Returns World Cup matches when configured, otherwise deterministic demo matches.")
            .Produces<MatchesResponseDto>();

        app.MapGet("/api/demo-matches", async (
                GetMatchesHandler handler,
                CancellationToken cancellationToken) =>
            {
                var response = await handler.HandleAsync(new GetMatchesQuery(), cancellationToken);
                return Results.Ok(response.Matches);
            })
            .WithName("GetDemoMatches")
            .WithSummary("Get matches using the legacy demo route")
            .WithDescription("Compatibility route for older local clients. New clients should use /api/matches.")
            .Produces<IReadOnlyList<MatchDto>>();

        app.MapGet("/health/matches-provider", (IMatchProviderHealthReader healthReader) =>
            Results.Ok(healthReader.GetHealth()))
            .WithName("GetMatchesProviderHealth")
            .WithSummary("Get match provider health")
            .WithDescription("Reports whether the optional fixture provider is configured without exposing secrets.")
            .Produces<MatchProviderHealth>();

        app.MapGet("/health/live-providers", (ILiveProviderHealthReader healthReader) =>
            Results.Ok(healthReader.GetHealth()))
            .WithName("GetLiveProvidersHealth")
            .WithSummary("Get live observation provider health")
            .WithDescription("Reports configured state, polling interval, freshness, backoff, and quota metadata without exposing credentials.")
            .Produces<IReadOnlyList<LiveProviderHealthDto>>();

        return app;
    }
}
