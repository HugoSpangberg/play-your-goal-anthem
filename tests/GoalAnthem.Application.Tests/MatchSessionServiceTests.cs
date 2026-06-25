using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using GoalAnthem.Infrastructure.MatchSessions;
using Microsoft.Extensions.Logging.Abstractions;

namespace GoalAnthem.Application.Tests;

public sealed class MatchSessionServiceTests
{
    [Fact]
    public async Task CreateValidatesSupportedTeamAndSpeed()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<MatchSessionProblemException>(() =>
            service.CreateAsync(CreateRequest("unknown-team", "demo"), CancellationToken.None));
        await Assert.ThrowsAsync<MatchSessionProblemException>(() =>
            service.CreateAsync(CreateRequest("north-harbor-fc", "fast"), CancellationToken.None));
    }

    [Fact]
    public async Task DemoSpeedProcessesEventsInOrderAcrossLargeJumps()
    {
        var time = new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z"));
        var notifier = new RecordingNotifier();
        var service = CreateService(time, notifier);
        var created = await service.CreateAsync(CreateRequest("north-harbor-fc", "demo"), CancellationToken.None);

        time.Advance(TimeSpan.FromSeconds(184));
        await service.AdvanceAllAsync(CancellationToken.None);

        var snapshot = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal(46 * 60, snapshot.ElapsedSeconds);
        Assert.Equal("live", snapshot.Status);
        Assert.Collection(
            snapshot.Timeline,
            kickoff => Assert.Equal("kickoff", kickoff.Type),
            goal => Assert.Equal("goal", goal.Type),
            halfTime => Assert.Equal("half-time", halfTime.Type),
            secondHalf => Assert.Equal("second-half", secondHalf.Type));
        Assert.Equal(1, snapshot.HomeScore);
        Assert.Equal(0, snapshot.AwayScore);
        Assert.Contains(notifier.Events, matchEvent => matchEvent.Type == "goal" && matchEvent.TeamId == "north-harbor-fc");
    }

    [Fact]
    public async Task NormalSpeedUsesRealMatchSecondsAndStopsAtFullTime()
    {
        var time = new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z"));
        var service = CreateService(time);
        var created = await service.CreateAsync(CreateRequest("north-harbor-fc", "normal"), CancellationToken.None);

        time.Advance(TimeSpan.FromSeconds(90 * 60));
        await service.AdvanceAllAsync(CancellationToken.None);
        var fullTime = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal(90 * 60, fullTime.ElapsedSeconds);
        Assert.Equal("ended", fullTime.Status);
        Assert.Equal(2, fullTime.HomeScore);
        Assert.Equal(1, fullTime.AwayScore);

        time.Advance(TimeSpan.FromMinutes(5));
        await service.AdvanceAllAsync(CancellationToken.None);
        var afterEnd = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal(fullTime.ElapsedSeconds, afterEnd.ElapsedSeconds);
        Assert.Equal(fullTime.Timeline.Count, afterEnd.Timeline.Count);
    }

    [Fact]
    public async Task EndIsIdempotentAndPreventsFurtherAdvancement()
    {
        var time = new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z"));
        var service = CreateService(time);
        var created = await service.CreateAsync(CreateRequest("north-harbor-fc", "demo"), CancellationToken.None);

        var ended = await service.EndAsync(created.SessionId, CancellationToken.None);
        var repeated = await service.EndAsync(created.SessionId, CancellationToken.None);
        time.Advance(TimeSpan.FromMinutes(10));
        await service.AdvanceAllAsync(CancellationToken.None);
        var afterAdvance = await service.GetSnapshotAsync(created.SessionId, CancellationToken.None);

        Assert.Equal("ended", ended.Status);
        Assert.Equal(ended.SessionId, repeated.SessionId);
        Assert.Equal(ended.Status, repeated.Status);
        Assert.Equal(ended.ElapsedSeconds, repeated.ElapsedSeconds);
        Assert.Equal(ended.ElapsedSeconds, afterAdvance.ElapsedSeconds);
    }

    [Fact]
    public async Task SessionsAreIsolated()
    {
        var time = new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z"));
        var service = CreateService(time);
        var first = await service.CreateAsync(CreateRequest("north-harbor-fc", "demo"), CancellationToken.None);
        var second = await service.CreateAsync(CreateRequest("eastgate-city", "normal"), CancellationToken.None);

        time.Advance(TimeSpan.FromSeconds(56));
        await service.AdvanceAllAsync(CancellationToken.None);

        var firstSnapshot = await service.GetSnapshotAsync(first.SessionId, CancellationToken.None);
        var secondSnapshot = await service.GetSnapshotAsync(second.SessionId, CancellationToken.None);

        Assert.Equal(14 * 60, firstSnapshot.ElapsedSeconds);
        Assert.Equal(56, secondSnapshot.ElapsedSeconds);
        Assert.NotEqual(firstSnapshot.SessionId, secondSnapshot.SessionId);
    }

    private static InMemoryMatchSessionService CreateService(
        TestTimeProvider? timeProvider = null,
        RecordingNotifier? notifier = null) =>
        new(
            notifier ?? new RecordingNotifier(),
            NullLogger<InMemoryMatchSessionService>.Instance,
            timeProvider ?? new TestTimeProvider(DateTimeOffset.Parse("2026-06-24T10:00:00Z")));

    private static CreateMatchSessionRequest CreateRequest(string supportedTeamId, string speed) =>
        new(
            new MatchDto(
                "demo-2026-summer-cup-001",
                DateTimeOffset.Parse("2026-07-04T18:00:00+02:00"),
                "playable",
                new TeamDto("north-harbor-fc", "North Harbor FC"),
                new TeamDto("eastgate-city", "Eastgate City")),
            supportedTeamId,
            speed);

    private sealed class RecordingNotifier : IMatchSessionNotifier
    {
        public List<MatchSessionEventDto> Events { get; } = [];

        public Task EventProcessedAsync(string sessionId, MatchSessionEventDto matchEvent, CancellationToken cancellationToken)
        {
            Events.Add(matchEvent);
            return Task.CompletedTask;
        }

        public Task SessionEndedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task SnapshotUpdatedAsync(string sessionId, MatchSessionSnapshotDto snapshot, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class TestTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset utcNow = utcNow;

        public override DateTimeOffset GetUtcNow() => utcNow;

        public void Advance(TimeSpan timeSpan) => utcNow += timeSpan;
    }
}
