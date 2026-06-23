using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<GetMatchesHandler>();
        services.AddSingleton<IMatchSessionNotifier, NoOpMatchSessionNotifier>();
        return services;
    }
}
