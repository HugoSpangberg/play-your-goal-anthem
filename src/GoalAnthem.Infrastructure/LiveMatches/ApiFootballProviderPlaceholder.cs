using GoalAnthem.Application.LiveMatches;
using Microsoft.Extensions.Options;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class ApiFootballProviderPlaceholder(IOptions<ApiFootballSettings> settings) : ILiveMatchFeedProvider
{
    public string Name => "API-Football (placeholder)";

    public bool IsConfigured => false;

    public TimeSpan PollInterval => TimeSpan.FromSeconds(Math.Max(60, settings.Value.RefreshSeconds));

    public TimeSpan InitialDelay => TimeSpan.FromSeconds(Math.Max(0, settings.Value.StartDelaySeconds));

    public int? RequestsUsedToday => 0;

    public int? RequestsRemainingToday => settings.Value.DailyLimit;

    public Task<IReadOnlyList<LiveMatchObservation>> GetLiveMatchesAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<LiveMatchObservation>>([]);
}
