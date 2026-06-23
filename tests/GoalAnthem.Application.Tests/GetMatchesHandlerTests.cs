using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Tests;

public sealed class GetMatchesHandlerTests
{
    [Fact]
    public async Task HandleAsyncMapsProviderResultInKickoffOrder()
    {
        var fetchedAt = DateTimeOffset.Parse("2026-06-23T12:00:00Z");
        var handler = new GetMatchesHandler(new StubMatchProvider(new MatchProviderResult(
            [
                CreateMatch("later", "2026-07-06T19:45:00+02:00"),
                CreateMatch("earlier", "2026-07-04T18:00:00+02:00")
            ],
            MatchDataSource.LiveWorldCup,
            fetchedAt,
            IsFallback: false,
            Message: null)));

        var response = await handler.HandleAsync(new GetMatchesQuery(), CancellationToken.None);

        Assert.Equal("liveWorldCup", response.Source);
        Assert.False(response.IsFallback);
        Assert.Equal(fetchedAt, response.FetchedAt);
        Assert.Collection(
            response.Matches,
            first => Assert.Equal("earlier", first.Id),
            second => Assert.Equal("later", second.Id));
    }

    private static DemoMatch CreateMatch(string id, string kickoffTime) =>
        DemoMatch.Create(
            new MatchId(id),
            DateTimeOffset.Parse(kickoffTime),
            MatchStatus.Upcoming,
            Team.Create(new TeamId($"{id}-home"), "Home"),
            Team.Create(new TeamId($"{id}-away"), "Away"));

    private sealed class StubMatchProvider(MatchProviderResult result) : IMatchProvider
    {
        public Task<MatchProviderResult> GetMatchesAsync(MatchProviderRequest request, CancellationToken cancellationToken) =>
            Task.FromResult(result);
    }
}
