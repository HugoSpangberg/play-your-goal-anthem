using GoalAnthem.Application.Matches.GetDemoMatches;
using GoalAnthem.Infrastructure.DemoMatches;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<IGetDemoMatchesDataSource, DemoMatchFileDataSource>();
        return services;
    }
}
