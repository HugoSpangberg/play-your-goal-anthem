using GoalAnthem.Application.Matches.GetDemoMatches;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<GetDemoMatchesHandler>();
        return services;
    }
}
