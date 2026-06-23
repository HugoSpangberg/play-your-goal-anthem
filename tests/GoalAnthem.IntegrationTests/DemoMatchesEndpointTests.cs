using System.Net;
using System.Net.Http.Json;
using GoalAnthem.Application.Matches.GetDemoMatches;
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
    public async Task GetDemoMatchesReturnsDeterministicMatches()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/demo-matches", CancellationToken.None);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var matches = await response.Content.ReadFromJsonAsync<IReadOnlyList<DemoMatchDto>>(
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
}
