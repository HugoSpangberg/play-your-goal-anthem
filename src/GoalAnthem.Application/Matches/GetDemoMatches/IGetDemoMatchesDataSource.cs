using GoalAnthem.Domain.Matches;

namespace GoalAnthem.Application.Matches.GetDemoMatches;

public interface IGetDemoMatchesDataSource
{
    Task<IReadOnlyList<DemoMatch>> GetDemoMatchesAsync(CancellationToken cancellationToken);
}
