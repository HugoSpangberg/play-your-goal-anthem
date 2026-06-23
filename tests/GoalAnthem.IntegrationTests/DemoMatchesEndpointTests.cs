using System.Net;
using System.Net.Http.Json;
using GoalAnthem.Application.Matches.GetMatches;
using Microsoft.AspNetCore.Mvc.Testing;

namespace GoalAnthem.IntegrationTests;

public sealed class DemoMatchesEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;

    public DemoMatchesEndpointTests(WebApplicationFactory<Program> factory)
    {
        this.factory = factory;
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
}
