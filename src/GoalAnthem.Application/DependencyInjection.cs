using GoalAnthem.Application.Matches.GetMatches;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<GetMatchesHandler>();
        return services;
    }
}
