using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Matches.GetDemoMatches;

public sealed class GetDemoMatchesHandler(IGetDemoMatchesDataSource dataSource)
{
    public async Task<IReadOnlyList<DemoMatchDto>> HandleAsync(
        GetDemoMatchesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var matches = await dataSource.GetDemoMatchesAsync(cancellationToken);

        return matches
            .OrderBy(match => match.KickoffTime)
            .ThenBy(match => match.Id.Value, StringComparer.Ordinal)
            .Select(Map)
            .ToArray();
    }

    private static DemoMatchDto Map(DemoMatch match) =>
        new(
            match.Id.Value,
            match.KickoffTime,
            match.Status.ToString().ToLowerInvariant(),
            Map(match.HomeTeam),
            Map(match.AwayTeam));

    private static TeamDto Map(Team team) => new(team.Id.Value, team.Name);
}
