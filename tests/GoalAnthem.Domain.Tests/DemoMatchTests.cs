using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Domain.Tests;

public sealed class DemoMatchTests
{
    [Fact]
    public void CreateRejectsSameHomeAndAwayTeam()
    {
        var team = Team.Create(new TeamId("north-harbor-fc"), "North Harbor FC");

        var exception = Assert.Throws<ArgumentException>(() =>
            DemoMatch.Create(
                new MatchId("match-1"),
                DateTimeOffset.Parse("2026-07-04T18:00:00+02:00"),
                MatchStatus.Playable,
                team,
                team));

        Assert.Contains("different", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void MatchIdRequiresValue(string value)
    {
        Assert.Throws<ArgumentException>(() => new MatchId(value));
    }

    [Fact]
    public void TeamNameIsTrimmed()
    {
        var team = Team.Create(new TeamId("north-harbor-fc"), "  North Harbor FC  ");

        Assert.Equal("North Harbor FC", team.Name);
    }
}
