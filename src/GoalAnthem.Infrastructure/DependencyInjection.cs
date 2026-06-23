using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using GoalAnthem.Infrastructure.DemoMatches;
using GoalAnthem.Infrastructure.MatchSessions;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddOptions<FootballDataOptions>().BindConfiguration(FootballDataOptions.SectionName);
        services.AddHttpClient("FootballData", client =>
        {
            client.BaseAddress = new Uri("https://api.football-data.org/");
            client.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<DemoMatchFileDataSource>();
        services.AddSingleton<ConfiguredMatchProvider>();
        services.AddSingleton<IMatchProvider>(provider => provider.GetRequiredService<ConfiguredMatchProvider>());
        services.AddSingleton<IMatchProviderHealthReader>(provider => provider.GetRequiredService<ConfiguredMatchProvider>());
        services.AddSingleton<InMemoryMatchSessionService>();
        services.AddSingleton<IMatchSessionService>(provider => provider.GetRequiredService<InMemoryMatchSessionService>());
        services.AddHostedService<MatchSessionWorker>();
        return services;
    }
}
