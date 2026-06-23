using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Matches.GetMatches;

public sealed class GetMatchesHandler(IMatchProvider matchProvider)
{
    public async Task<MatchesResponseDto> HandleAsync(GetMatchesQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var result = await matchProvider.GetMatchesAsync(
            new MatchProviderRequest(query.ForceRefresh),
            cancellationToken);

        var matches = result.Matches
            .OrderBy(match => match.KickoffTime)
            .ThenBy(match => match.Id.Value, StringComparer.Ordinal)
            .Select(Map)
            .ToArray();

        return new MatchesResponseDto(
            matches,
            Map(result.Source),
            result.FetchedAt,
            result.IsFallback,
            result.Message);
    }

    private static MatchDto Map(DemoMatch match) =>
        new(
            match.Id.Value,
            match.KickoffTime,
            match.Status.ToString().ToLowerInvariant(),
            Map(match.HomeTeam),
            Map(match.AwayTeam));

    private static TeamDto Map(Team team) => new(team.Id.Value, team.Name);

    private static string Map(MatchDataSource source) =>
        source switch
        {
            MatchDataSource.LiveWorldCup => "liveWorldCup",
            _ => "demo",
        };
}
