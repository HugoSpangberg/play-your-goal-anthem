using System.Net;
using GoalAnthem.Application.Matches.GetMatches;
using GoalAnthem.Infrastructure.DemoMatches;
using GoalAnthem.Infrastructure.Matches;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace GoalAnthem.Application.Tests;

public sealed class ConfiguredMatchProviderTests
{
    [Fact]
    public async Task UsesDemoFallbackWithoutToken()
    {
        var http = new RecordingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var provider = CreateProvider(http, apiToken: null);

        var result = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None);

        Assert.Equal(MatchDataSource.Demo, result.Source);
        Assert.True(result.IsFallback);
        Assert.Contains(result.Matches, match => match.Id.Value == "demo-2026-summer-cup-001");
        Assert.Equal(0, http.RequestCount);
    }

    [Fact]
    public async Task MapsScheduledAndInProgressWorldCupMatchesDefensively()
    {
        var http = new RecordingHttpMessageHandler(_ => JsonResponse(
            """
            {
              "matches": [
                {
                  "id": 1001,
                  "utcDate": "2026-06-11T19:00:00Z",
                  "status": "SCHEDULED",
                  "homeTeam": { "id": 11, "name": "Canada" },
                  "awayTeam": { "id": 12, "name": "Mexico" }
                },
                {
                  "id": 1002,
                  "utcDate": "2026-06-12T21:00:00Z",
                  "status": "IN_PLAY",
                  "homeTeam": { "id": 13, "name": "Brazil" },
                  "awayTeam": { "id": 14, "name": "Japan" }
                },
                {
                  "id": 1003,
                  "utcDate": "2026-06-10T21:00:00Z",
                  "status": "FINISHED",
                  "homeTeam": { "id": 16, "name": "Spain" },
                  "awayTeam": { "id": 17, "name": "France" }
                },
                {
                  "id": null,
                  "utcDate": "not-a-date",
                  "status": "SCHEDULED",
                  "homeTeam": { "id": null, "name": "" },
                  "awayTeam": { "id": 15, "name": "Invalid" }
                }
              ]
            }
            """));
        var provider = CreateProvider(http, apiToken: "free-token");

        var result = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None);

        Assert.Equal(MatchDataSource.LiveWorldCup, result.Source);
        Assert.False(result.IsFallback);
        Assert.Collection(
            result.Matches,
            first =>
            {
                Assert.Equal("football-data-wc-1001", first.Id.Value);
                Assert.Equal("Canada", first.HomeTeam.Name);
                Assert.Equal("Mexico", first.AwayTeam.Name);
                Assert.Equal(GoalAnthem.Domain.Matches.MatchStatus.Upcoming, first.Status);
            },
            second =>
            {
                Assert.Equal("football-data-wc-1002", second.Id.Value);
                Assert.Equal(GoalAnthem.Domain.Matches.MatchStatus.Live, second.Status);
            });
        Assert.Equal("free-token", http.Requests.Single().Headers.GetValues("X-Auth-Token").Single());
        Assert.Equal("/v4/competitions/WC/matches", http.Requests.Single().RequestUri?.PathAndQuery);
        Assert.DoesNotContain("status=", http.Requests.Single().RequestUri?.PathAndQuery, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UsesCacheAndPreventsConcurrentDuplicateUpstreamRequests()
    {
        var http = new RecordingHttpMessageHandler(_ => JsonResponse("""{ "matches": [] }"""));
        var provider = CreateProvider(http, apiToken: "free-token");

        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None)));

        Assert.Equal(1, http.RequestCount);
    }

    [Fact]
    public async Task ProviderFailureUsesCachedDataWhenAvailable()
    {
        var timeProvider = new TestTimeProvider(DateTimeOffset.Parse("2026-06-23T12:00:00Z"));
        var http = new RecordingHttpMessageHandler(request =>
            request.RequestNumber == 1
                ? JsonResponse("""{ "matches": [{ "id": 1001, "utcDate": "2026-06-11T19:00:00Z", "status": "SCHEDULED", "homeTeam": { "id": 11, "name": "Canada" }, "awayTeam": { "id": 12, "name": "Mexico" } }] }""")
                : new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var provider = CreateProvider(http, apiToken: "free-token", timeProvider);

        var initial = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None);
        timeProvider.Advance(TimeSpan.FromSeconds(16));
        var fallback = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: true), CancellationToken.None);

        Assert.Equal(MatchDataSource.LiveWorldCup, initial.Source);
        Assert.Equal(MatchDataSource.LiveWorldCup, fallback.Source);
        Assert.False(fallback.IsFallback);
        Assert.Contains("last successful response", fallback.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ProviderFailureWithoutCacheReturnsDemoFallback()
    {
        var http = new RecordingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var provider = CreateProvider(http, apiToken: "free-token");

        var result = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None);

        Assert.Equal(MatchDataSource.Demo, result.Source);
        Assert.True(result.IsFallback);
        Assert.Contains("deterministic demo data", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RateLimitFallsBackSafely()
    {
        var http = new RecordingHttpMessageHandler(_ => new HttpResponseMessage((HttpStatusCode)429));
        var provider = CreateProvider(http, apiToken: "free-token");

        var result = await provider.GetMatchesAsync(new MatchProviderRequest(ForceRefresh: false), CancellationToken.None);

        Assert.Equal(MatchDataSource.Demo, result.Source);
        Assert.True(result.IsFallback);
        Assert.Contains("rate-limited", result.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static ConfiguredMatchProvider CreateProvider(
        RecordingHttpMessageHandler http,
        string? apiToken,
        TimeProvider? timeProvider = null)
    {
        var contentRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../..", "demo/matches"));
        var demoSource = new DemoMatchFileDataSource(
            new TestEnvironment(contentRoot),
            NullLogger<DemoMatchFileDataSource>.Instance);

        return new ConfiguredMatchProvider(
            demoSource,
            new TestHttpClientFactory(http),
            Options.Create(new FootballDataOptions { ApiToken = apiToken }),
            NullLogger<ConfiguredMatchProvider>.Instance,
            timeProvider ?? new TestTimeProvider(DateTimeOffset.Parse("2026-06-23T12:00:00Z")));
    }

    private static HttpResponseMessage JsonResponse(string json) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        };

    private sealed class RecordingHttpMessageHandler(Func<RecordedRequest, HttpResponseMessage> responseFactory) : HttpMessageHandler
    {
        private readonly object gate = new();
        private readonly List<HttpRequestMessage> requests = [];

        public int RequestCount
        {
            get
            {
                lock (gate)
                {
                    return requests.Count;
                }
            }
        }

        public IReadOnlyList<HttpRequestMessage> Requests
        {
            get
            {
                lock (gate)
                {
                    return requests.ToArray();
                }
            }
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            int requestNumber;
            lock (gate)
            {
                requests.Add(request);
                requestNumber = requests.Count;
            }

            return Task.FromResult(responseFactory(new RecordedRequest(request, requestNumber)));
        }
    }

    private sealed record RecordedRequest(HttpRequestMessage Request, int RequestNumber);

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new(handler, disposeHandler: false)
            {
                BaseAddress = new Uri("https://api.football-data.org/")
            };
    }

    private sealed class TestTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        private DateTimeOffset utcNow = utcNow;

        public override DateTimeOffset GetUtcNow() => utcNow;

        public void Advance(TimeSpan timeSpan) => utcNow += timeSpan;
    }

    private sealed class TestEnvironment(string contentRootPath) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "GoalAnthem.Tests";
        public string ContentRootPath { get; set; } = contentRootPath;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
