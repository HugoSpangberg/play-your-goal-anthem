using GoalAnthem.Application.Matches.GetDemoMatches;
using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Tests;

public sealed class GetDemoMatchesHandlerTests
{
    [Fact]
    public async Task HandleAsyncMapsMatchesInKickoffOrder()
    {
        var handler = new GetDemoMatchesHandler(new StubDataSource(
        [
            CreateMatch("later", "2026-07-06T19:45:00+02:00"),
            CreateMatch("earlier", "2026-07-04T18:00:00+02:00")
        ]));

        var matches = await handler.HandleAsync(new GetDemoMatchesQuery(), CancellationToken.None);

        Assert.Collection(
            matches,
            first =>
            {
                Assert.Equal("earlier", first.Id);
                Assert.Equal("playable", first.Status);
                Assert.Equal("North Harbor FC", first.HomeTeam.Name);
            },
            second => Assert.Equal("later", second.Id));
    }

    private static DemoMatch CreateMatch(string id, string kickoffTime) =>
        DemoMatch.Create(
            new MatchId(id),
            DateTimeOffset.Parse(kickoffTime),
            MatchStatus.Playable,
            Team.Create(new TeamId("north-harbor-fc"), "North Harbor FC"),
            Team.Create(new TeamId("eastgate-city"), "Eastgate City"));

    private sealed class StubDataSource(IReadOnlyList<DemoMatch> matches) : IGetDemoMatchesDataSource
    {
        public Task<IReadOnlyList<DemoMatch>> GetDemoMatchesAsync(CancellationToken cancellationToken) =>
            Task.FromResult(matches);
    }
}
