using System.Net;
using System.Text.Json;
using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.Options;

namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class OpenLigaDbLiveMatchProvider(
    IHttpClientFactory httpClientFactory,
    IOptions<OpenLigaDbSettings> settings,
    TimeProvider timeProvider)
    : ILiveMatchFeedProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Name => "OpenLigaDB";

    public bool IsConfigured =>
        settings.Value.Enabled &&
        !string.IsNullOrWhiteSpace(settings.Value.LeagueShortcut) &&
        settings.Value.Season > 0;

    public TimeSpan PollInterval => TimeSpan.FromSeconds(Math.Max(10, settings.Value.RefreshSeconds));

    public TimeSpan InitialDelay => TimeSpan.FromSeconds(Math.Max(0, settings.Value.StartDelaySeconds));

    public int? RequestsUsedToday => null;

    public int? RequestsRemainingToday => null;

    public async Task<IReadOnlyList<LiveMatchObservation>> GetLiveMatchesAsync(CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            return [];
        }

        var client = httpClientFactory.CreateClient("OpenLigaDb");
        var path = $"getmatchdata/{Uri.EscapeDataString(settings.Value.LeagueShortcut)}/{settings.Value.Season}";
        using var response = await client.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode == (HttpStatusCode)429)
        {
            throw new LiveProviderRateLimitException(GetRetryAfter(response));
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var matches = await JsonSerializer.DeserializeAsync<IReadOnlyList<OpenLigaMatch>>(stream, JsonOptions, cancellationToken) ?? [];
        var now = timeProvider.GetUtcNow();

        return matches
            .Where(match => match.MatchDateTimeUtc <= now.AddMinutes(45))
            .Where(match => !match.MatchIsFinished || match.MatchDateTimeUtc >= now.AddHours(-6))
            .Select(match => Map(match, now))
            .Where(observation => observation is not null)
            .Cast<LiveMatchObservation>()
            .ToArray();
    }

    private static LiveMatchObservation? Map(OpenLigaMatch match, DateTimeOffset observedAt)
    {
        if (match.MatchId <= 0 ||
            match.Team1 is null ||
            match.Team2 is null ||
            string.IsNullOrWhiteSpace(match.Team1.TeamName) ||
            string.IsNullOrWhiteSpace(match.Team2.TeamName))
        {
            return null;
        }

        var result = match.MatchResults?
            .OrderByDescending(item => item.ResultOrderId)
            .ThenByDescending(item => item.ResultTypeId)
            .FirstOrDefault();

        return new LiveMatchObservation(
            "OpenLigaDB",
            match.MatchId.ToString(System.Globalization.CultureInfo.InvariantCulture),
            match.MatchDateTimeUtc,
            observedAt,
            match.Team1.TeamName,
            match.Team2.TeamName,
            CountryCodeResolver.Resolve(match.Team1.ShortName, match.Team1.TeamName),
            CountryCodeResolver.Resolve(match.Team2.ShortName, match.Team2.TeamName),
            Math.Max(0, result?.PointsTeam1 ?? 0),
            Math.Max(0, result?.PointsTeam2 ?? 0),
            match.MatchIsFinished ? "ended" : "live",
            null);
    }

    private static TimeSpan? GetRetryAfter(HttpResponseMessage response)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
        {
            return delta;
        }

        if (response.Headers.RetryAfter?.Date is { } date)
        {
            return date - DateTimeOffset.UtcNow;
        }

        return null;
    }

    private sealed record OpenLigaMatch(
        long MatchId,
        DateTimeOffset MatchDateTimeUtc,
        bool MatchIsFinished,
        OpenLigaTeam? Team1,
        OpenLigaTeam? Team2,
        IReadOnlyList<OpenLigaResult>? MatchResults);

    private sealed record OpenLigaTeam(long TeamId, string? TeamName, string? ShortName);

    private sealed record OpenLigaResult(
        int PointsTeam1,
        int PointsTeam2,
        int ResultOrderId,
        int ResultTypeId);
}
