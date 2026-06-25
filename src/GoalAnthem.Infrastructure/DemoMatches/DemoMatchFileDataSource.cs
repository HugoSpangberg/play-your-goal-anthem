using System.Text.Json;
using GoalAnthem.Domain.Matches;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GoalAnthem.Infrastructure.DemoMatches;

public sealed class DemoMatchFileDataSource(
    IHostEnvironment environment,
    ILogger<DemoMatchFileDataSource> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<DemoMatch>> GetDemoMatchesAsync(CancellationToken cancellationToken)
    {
        var path = Path.Combine(environment.ContentRootPath, "demo-matches.json");
        if (!File.Exists(path))
        {
            path = Path.Combine(AppContext.BaseDirectory, "demo-matches.json");
        }

        await using var stream = File.OpenRead(path);
        var document = await JsonSerializer.DeserializeAsync<DemoMatchDocument>(stream, JsonOptions, cancellationToken);

        if (document is null)
        {
            throw new InvalidOperationException("Demo match data could not be read.");
        }

        var matches = document.Matches.Select(MapMatch).ToArray();
        logger.LogInformation("Loaded {MatchCount} deterministic demo matches.", matches.Length);
        return matches;
    }

    private static DemoMatch MapMatch(DemoMatchRecord record)
    {
        if (!Enum.TryParse<MatchStatus>(record.Status, ignoreCase: true, out var status))
        {
            throw new InvalidOperationException($"Unsupported match status '{record.Status}' for match '{record.Id}'.");
        }

        return DemoMatch.Create(
            new MatchId(record.Id),
            record.KickoffTime,
            status,
            Team.Create(new TeamId(record.HomeTeam.Id), record.HomeTeam.Name, record.HomeTeam.CountryCode),
            Team.Create(new TeamId(record.AwayTeam.Id), record.AwayTeam.Name, record.AwayTeam.CountryCode));
    }

    private sealed record DemoMatchDocument(IReadOnlyList<DemoMatchRecord> Matches);

    private sealed record DemoMatchRecord(
        string Id,
        DateTimeOffset KickoffTime,
        string Status,
        TeamRecord HomeTeam,
        TeamRecord AwayTeam);

    private sealed record TeamRecord(string Id, string Name, string? CountryCode);
}
