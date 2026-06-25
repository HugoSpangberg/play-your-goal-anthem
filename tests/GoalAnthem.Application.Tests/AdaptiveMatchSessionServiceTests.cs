using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using GoalAnthem.Infrastructure.LiveMatches;
using Microsoft.Extensions.Logging.Abstractions;

namespace GoalAnthem.Application.Tests;

public sealed class AdaptiveMatchSessionServiceTests
{
    [Fact]
    public async Task NormalModeUsesExternalScoresWithoutDeterministicGoals()
    {
        var time = new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z"));
        var service = CreateService(time);
        var created = await service.CreateAsync(CreateRequest("normal"), CancellationToken.None);

        time.Advance(TimeSpan.FromMinutes(90));
        await service.AdvanceAllAsync(CancellationToken.None);
        var beforeObservation = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal(0, beforeObservation.HomeScore);
        Assert.Empty(beforeObservation.Timeline);

        await service.ApplyLiveObservationAsync(
            created.SessionId,
            CreateObservation("OpenLigaDB", 1, 0),
            CancellationToken.None);
        await service.ApplyLiveObservationAsync(
            created.SessionId,
            CreateObservation("football-data.org", 1, 0),
            CancellationToken.None);

        var snapshot = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);
        Assert.Equal(1, snapshot.HomeScore);
        Assert.Single(snapshot.Timeline, matchEvent => matchEvent.Type == "goal");
    }

    [Fact]
    public async Task DemoModeIgnoresExternalScores()
    {
        var service = CreateService();
        var created = await service.CreateAsync(CreateRequest("demo"), CancellationToken.None);

        await service.ApplyLiveObservationAsync(
            created.SessionId,
            CreateObservation("OpenLigaDB", 3, 2),
            CancellationToken.None);
        var snapshot = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal(0, snapshot.HomeScore);
        Assert.Equal(0, snapshot.AwayScore);
        Assert.Single(snapshot.Timeline);
        Assert.Equal("kickoff", snapshot.Timeline[0].Type);
    }

    private static AdaptiveMatchSessionService CreateService(TestTimeProvider? timeProvider = null) =>
        new(
            new NoOpMatchSessionNotifier(),
            NullLogger<AdaptiveMatchSessionService>.Instance,
            timeProvider ?? new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z")));

    private static CreateMatchSessionRequest CreateRequest(string speed) =>
        new(
            new MatchDto(
                "world-cup-test",
                DateTimeOffset.Parse("2026-06-24T18:00:00Z"),
                "upcoming",
                new TeamDto("home", "Sweden", "SE"),
                new TeamDto("away", "Japan", "JP")),
            "home",
            speed);

    private static LiveMatchObservation CreateObservation(string provider, int homeScore, int awayScore) =>
        new(
            provider,
            $"{provider}-match",
            DateTimeOffset.Parse("2026-06-24T18:00:00Z"),
            DateTimeOffset.Parse("2026-06-24T18:15:00Z"),
            "Sweden",
            "Japan",
            "SE",
            "JP",
            homeScore,
            awayScore,
            "live",
            15 * 60);

    private sealed class TestTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset utcNow = utcNow;
        public override DateTimeOffset GetUtcNow() => utcNow;
        public void Advance(TimeSpan timeSpan) => utcNow += timeSpan;
    }
}
