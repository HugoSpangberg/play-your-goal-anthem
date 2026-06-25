using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Application.MatchSessions;
using GoalAnthem.Infrastructure.DemoMatches;
using GoalAnthem.Infrastructure.LiveMatches;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.DependencyInjection;

namespace GoalAnthem.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddOptions<FootballDataOptions>().BindConfiguration(FootballDataOptions.SectionName);
        services.AddOptions<OpenLigaDbSettings>().BindConfiguration(OpenLigaDbSettings.SectionName);
        services.AddOptions<ApiFootballSettings>().BindConfiguration(ApiFootballSettings.SectionName);
        services.AddHttpClient("FootballData", client =>
        {
            client.BaseAddress = new Uri("https://api.football-data.org/");
            client.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddHttpClient("OpenLigaDb", client =>
        {
            client.BaseAddress = new Uri("https://api.openligadb.de/");
            client.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<DemoMatchFileDataSource>();
        services.AddSingleton<ConfiguredMatchProvider>();
        services.AddSingleton<IMatchProvider>(provider => provider.GetRequiredService<ConfiguredMatchProvider>());
        services.AddSingleton<IMatchProviderHealthReader>(provider => provider.GetRequiredService<ConfiguredMatchProvider>());
        services.AddSingleton<ILiveMatchFeedProvider, OpenLigaDbLiveMatchProvider>();
        services.AddSingleton<ILiveMatchFeedProvider, ApiFootballProviderPlaceholder>();
        services.AddSingleton<AdaptiveMatchSessionService>();
        services.AddSingleton<IMatchSessionService>(provider => provider.GetRequiredService<AdaptiveMatchSessionService>());
        services.AddHostedService<LiveRefreshHostedService>();
        return services;
    }
}
