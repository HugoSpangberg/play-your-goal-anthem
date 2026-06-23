namespace GoalAnthem.Domain.Matches;

public sealed record DemoMatch(
    MatchId Id,
    DateTimeOffset KickoffTime,
    MatchStatus Status,
    Team HomeTeam,
    Team AwayTeam)
{
    public static DemoMatch Create(
        MatchId id,
        DateTimeOffset kickoffTime,
        MatchStatus status,
        Team homeTeam,
        Team awayTeam)
    {
        if (homeTeam.Id == awayTeam.Id)
        {
            throw new ArgumentException("Home and away teams must be different.", nameof(awayTeam));
        }

        return new DemoMatch(id, kickoffTime, status, homeTeam, awayTeam);
    }
}
