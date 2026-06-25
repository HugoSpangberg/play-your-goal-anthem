using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Domain.Matches;
using GoalAnthem.Infrastructure.DemoMatches;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GoalAnthem.Infrastructure.Matches;

public sealed class ConfiguredMatchProvider(
    DemoMatchFileDataSource demoMatches,
    IHttpClientFactory httpClientFactory,
    IOptions<FootballDataOptions> options,
    ILogger<ConfiguredMatchProvider> logger,
    TimeProvider timeProvider)
    : IMatchProvider, IMatchProviderHealthReader, ILiveMatchFeedProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan MinimumRefreshInterval = TimeSpan.FromSeconds(15);
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private CacheEntry? cache;
    private DateTimeOffset? lastRefreshAttempt;
    private DateTimeOffset? lastFailedFetch;
    private string? lastFailure;

    public string Name => "football-data.org";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiToken);

    public TimeSpan PollInterval => TimeSpan.FromMinutes(5);

    public TimeSpan InitialDelay => TimeSpan.FromSeconds(43);

    public int? RequestsUsedToday => null;

    public int? RequestsRemainingToday => null;

    public async Task<MatchProviderResult> GetMatchesAsync(MatchProviderRequest request, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var token = options.Value.ApiToken;

        if (string.IsNullOrWhiteSpace(token))
        {
            return await GetDemoFallbackAsync("Demo data is shown because World Cup API data is not configured.", cancellationToken);
        }

        if (!request.ForceRefresh && TryGetFreshCache(now, out var cached))
        {
            return cached.Result;
        }

        if (request.ForceRefresh && cache is not null && lastRefreshAttempt is not null && now - lastRefreshAttempt < MinimumRefreshInterval)
        {
            return cache.Result with { Message = "Refresh skipped briefly to protect the free upstream API." };
        }

        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            now = timeProvider.GetUtcNow();
            if (!request.ForceRefresh && TryGetFreshCache(now, out cached))
            {
                return cached.Result;
            }

            if (request.ForceRefresh && cache is not null && lastRefreshAttempt is not null && now - lastRefreshAttempt < MinimumRefreshInterval)
            {
                return cache.Result with { Message = "Refresh skipped briefly to protect the free upstream API." };
            }

            lastRefreshAttempt = now;

            try
            {
                var matches = await FetchWorldCupMatchesAsync(token, cancellationToken);
                var result = new MatchProviderResult(matches, MatchDataSource.LiveWorldCup, now, IsFallback: false, Message: null);
                cache = new CacheEntry(result, now.Add(CacheDuration));
                lastFailure = null;
                lastFailedFetch = null;

                return result;
            }
            catch (LiveProviderRateLimitException exception)
            {
                logger.LogWarning(exception, "football-data.org rate limit was reached while loading World Cup matches.");
                return await HandleProviderFailureAsync(now, "World Cup API data is temporarily rate-limited.", cancellationToken);
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException)
            {
                logger.LogWarning(exception, "World Cup match provider failed. Falling back safely.");
                return await HandleProviderFailureAsync(now, "World Cup API data is temporarily unavailable.", cancellationToken);
            }
        }
        finally
        {
            refreshLock.Release();
        }
    }

    public async Task<IReadOnlyList<LiveMatchObservation>> GetLiveMatchesAsync(CancellationToken cancellationToken)
    {
        var token = options.Value.ApiToken;
        if (string.IsNullOrWhiteSpace(token))
        {
            return [];
        }

        var document = await FetchWorldCupResponseAsync(token, cancellationToken);
        var observedAt = timeProvider.GetUtcNow();
        return document.Matches?
            .Select(record => MapLive(record, observedAt))
            .Where(observation => observation is not null)
            .Cast<LiveMatchObservation>()
            .ToArray() ?? [];
    }

    public MatchProviderHealth GetHealth()
    {
        var activeSource = cache?.Result.Source == MatchDataSource.LiveWorldCup ? "liveWorldCup" : "demo";

        return new MatchProviderHealth(
            LiveProviderConfigured: !string.IsNullOrWhiteSpace(options.Value.ApiToken),
            activeSource,
            cache?.Result.FetchedAt,
            lastFailedFetch,
            lastFailure);
    }

    private bool TryGetFreshCache(DateTimeOffset now, out CacheEntry cached)
    {
        if (cache is not null && cache.ExpiresAt > now)
        {
            cached = cache;
            return true;
        }

        cached = default!;
        return false;
    }

    private async Task<MatchProviderResult> HandleProviderFailureAsync(
        DateTimeOffset now,
        string message,
        CancellationToken cancellationToken)
    {
        lastFailedFetch = now;
        lastFailure = message;

        if (cache is not null)
        {
            return cache.Result with { Message = $"{message} Showing the last successful response." };
        }

        return await GetDemoFallbackAsync($"{message} Showing deterministic demo data instead.", cancellationToken);
    }

    private async Task<MatchProviderResult> GetDemoFallbackAsync(string message, CancellationToken cancellationToken)
    {
        var matches = await demoMatches.GetDemoMatchesAsync(cancellationToken);

        return new MatchProviderResult(
            matches,
            MatchDataSource.Demo,
            timeProvider.GetUtcNow(),
            IsFallback: true,
            message);
    }

    private async Task<IReadOnlyList<DemoMatch>> FetchWorldCupMatchesAsync(string token, CancellationToken cancellationToken)
    {
        var document = await FetchWorldCupResponseAsync(token, cancellationToken);
        return document.Matches?
            .Select(Map)
            .Where(match => match is not null)
            .Cast<DemoMatch>()
            .OrderBy(match => match.KickoffTime)
            .ThenBy(match => match.Id.Value, StringComparer.Ordinal)
            .ToArray() ?? [];
    }

    private async Task<FootballDataMatchesResponse> FetchWorldCupResponseAsync(string token, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "v4/competitions/WC/matches");
        request.Headers.Add("X-Auth-Token", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var client = httpClientFactory.CreateClient("FootballData");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode == (HttpStatusCode)429)
        {
            throw new LiveProviderRateLimitException(GetRetryAfter(response));
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonSerializer.DeserializeAsync<FootballDataMatchesResponse>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("football-data.org returned a malformed match response.");
    }

    private static DemoMatch? Map(FootballDataMatchRecord record)
    {
        if (record.Id is null or <= 0 ||
            string.IsNullOrWhiteSpace(record.UtcDate) ||
            record.HomeTeam?.Id is null or <= 0 ||
            record.AwayTeam?.Id is null or <= 0 ||
            string.IsNullOrWhiteSpace(record.HomeTeam.Name) ||
            string.IsNullOrWhiteSpace(record.AwayTeam.Name) ||
            !DateTimeOffset.TryParse(record.UtcDate, out var kickoffTime) ||
            !TryMapStatus(record.Status, out var status))
        {
            return null;
        }

        return DemoMatch.Create(
            new MatchId($"football-data-wc-{record.Id.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}"),
            kickoffTime,
            status,
            Team.Create(
                new TeamId($"football-data-team-{record.HomeTeam.Id.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}"),
                record.HomeTeam.Name,
                CountryCodeResolver.Resolve(record.HomeTeam.Tla, record.HomeTeam.Name)),
            Team.Create(
                new TeamId($"football-data-team-{record.AwayTeam.Id.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}"),
                record.AwayTeam.Name,
                CountryCodeResolver.Resolve(record.AwayTeam.Tla, record.AwayTeam.Name)));
    }

    private static LiveMatchObservation? MapLive(FootballDataMatchRecord record, DateTimeOffset observedAt)
    {
        if (record.Id is null or <= 0 ||
            string.IsNullOrWhiteSpace(record.UtcDate) ||
            record.HomeTeam is null ||
            record.AwayTeam is null ||
            string.IsNullOrWhiteSpace(record.HomeTeam.Name) ||
            string.IsNullOrWhiteSpace(record.AwayTeam.Name) ||
            !DateTimeOffset.TryParse(record.UtcDate, out var kickoffTime))
        {
            return null;
        }

        var status = record.Status?.ToUpperInvariant() switch
        {
            "IN_PLAY" => "live",
            "PAUSED" => "half-time",
            "FINISHED" => "ended",
            _ => null,
        };
        if (status is null)
        {
            return null;
        }

        return new LiveMatchObservation(
            "football-data.org",
            record.Id.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
            kickoffTime,
            observedAt,
            record.HomeTeam.Name,
            record.AwayTeam.Name,
            CountryCodeResolver.Resolve(record.HomeTeam.Tla, record.HomeTeam.Name),
            CountryCodeResolver.Resolve(record.AwayTeam.Tla, record.AwayTeam.Name),
            Math.Max(0, record.Score?.FullTime?.Home ?? 0),
            Math.Max(0, record.Score?.FullTime?.Away ?? 0),
            status,
            null);
    }

    private static bool TryMapStatus(string? value, out MatchStatus status)
    {
        status = MatchStatus.Upcoming;

        switch (value?.ToUpperInvariant())
        {
            case "SCHEDULED":
            case "TIMED":
                status = MatchStatus.Upcoming;
                return true;
            case "IN_PLAY":
            case "PAUSED":
                status = MatchStatus.Live;
                return true;
            default:
                return false;
        }
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

    private sealed record CacheEntry(MatchProviderResult Result, DateTimeOffset ExpiresAt);

    private sealed record FootballDataMatchesResponse(IReadOnlyList<FootballDataMatchRecord>? Matches);

    private sealed record FootballDataMatchRecord(
        int? Id,
        string? UtcDate,
        string? Status,
        FootballDataTeamRecord? HomeTeam,
        FootballDataTeamRecord? AwayTeam,
        FootballDataScore? Score);

    private sealed record FootballDataTeamRecord(int? Id, string? Name, string? Tla);

    private sealed record FootballDataScore(FootballDataScorePart? FullTime);

    private sealed record FootballDataScorePart(int? Home, int? Away);
}
