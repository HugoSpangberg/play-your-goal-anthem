using System.Net;
using System.Net.Http.Json;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Configuration;

namespace GoalAnthem.IntegrationTests;

public sealed class DemoMatchesEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public DemoMatchesEndpointTests(WebApplicationFactory<Program> factory)
    {
        this.factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["FootballData:ApiToken"] = string.Empty
                    });
            });
        });
    }

    [Fact]
    public async Task GetMatchesReturnsDeterministicFallbackWhenNoTokenIsConfigured()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/matches", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var matches = await response.Content.ReadFromJsonAsync<MatchesResponseDto>(
            cancellationToken: CancellationToken.None);

        Assert.NotNull(matches);
        Assert.Equal("demo", matches.Source);
        Assert.True(matches.IsFallback);
        Assert.Contains(matches.Matches, match => match.Id == "demo-2026-summer-cup-001");
    }

    [Fact]
    public async Task LegacyDemoMatchesRouteReturnsMatchArray()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/demo-matches", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var matches = await response.Content.ReadFromJsonAsync<IReadOnlyList<MatchDto>>(
            cancellationToken: CancellationToken.None);

        Assert.NotNull(matches);
        Assert.Contains(matches, match => match.Id == "demo-2026-summer-cup-001");
    }

    [Fact]
    public async Task HealthEndpointReturnsOk()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task MatchProviderHealthEndpointDoesNotExposeSecrets()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/matches-provider", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync(CancellationToken.None);
        Assert.DoesNotContain("ApiToken", content, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("X-Auth-Token", content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MatchSessionEndpointsCreateReadAndEndSession()
    {
        using var client = factory.CreateClient();

        var createResponse = await client.PostAsJsonAsync("/api/match-sessions", CreateSessionRequest(), CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<CreateMatchSessionResponse>(cancellationToken: CancellationToken.None);
        Assert.NotNull(created);
        Assert.Equal("live", created.Snapshot.Status);

        var getResponse = await client.GetAsync($"/api/match-sessions/{created.SessionId}", CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var endResponse = await client.PostAsync($"/api/match-sessions/{created.SessionId}/end", null, CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, endResponse.StatusCode);
        var ended = await endResponse.Content.ReadFromJsonAsync<MatchSessionSnapshotDto>(cancellationToken: CancellationToken.None);
        Assert.NotNull(ended);
        Assert.Equal("ended", ended.Status);

        var repeatedEnd = await client.PostAsync($"/api/match-sessions/{created.SessionId}/end", null, CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, repeatedEnd.StatusCode);
    }

    [Fact]
    public async Task MatchSessionEndpointReturnsProblemDetailsForInvalidTeam()
    {
        using var client = factory.CreateClient();
        var request = CreateSessionRequest() with { SupportedTeamId = "other-team" };

        var response = await client.PostAsJsonAsync("/api/match-sessions", request, CancellationToken.None);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task SignalRJoinReturnsAuthoritativeSnapshotAndUnknownSessionIsRejected()
    {
        using var client = factory.CreateClient();
        var createResponse = await client.PostAsJsonAsync("/api/match-sessions", CreateSessionRequest(), CancellationToken.None);
        var created = await createResponse.Content.ReadFromJsonAsync<CreateMatchSessionResponse>(cancellationToken: CancellationToken.None);
        Assert.NotNull(created);

        await using var connection = CreateHubConnection();
        await connection.StartAsync(CancellationToken.None);

        var snapshot = await connection.InvokeAsync<MatchSessionSnapshotDto>("JoinSession", created.SessionId, CancellationToken.None);

        Assert.Equal(created.SessionId, snapshot.SessionId);
        Assert.Equal("North Harbor FC", snapshot.SupportedTeam.Name);
        await Assert.ThrowsAsync<HubException>(() =>
            connection.InvokeAsync<MatchSessionSnapshotDto>("JoinSession", "missing-session", CancellationToken.None));
    }

    private HubConnection CreateHubConnection() =>
        new HubConnectionBuilder()
            .WithUrl(
                new Uri(factory.Server.BaseAddress, "/hubs/matches"),
                options =>
                {
                    options.Transports = HttpTransportType.LongPolling;
                    options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                })
            .Build();

    private static CreateMatchSessionRequest CreateSessionRequest() =>
        new(
            new MatchDto(
                "demo-2026-summer-cup-001",
                DateTimeOffset.Parse("2026-07-04T18:00:00+02:00"),
                "playable",
                new TeamDto("north-harbor-fc", "North Harbor FC"),
                new TeamDto("eastgate-city", "Eastgate City")),
            "north-harbor-fc",
            "demo");
}
