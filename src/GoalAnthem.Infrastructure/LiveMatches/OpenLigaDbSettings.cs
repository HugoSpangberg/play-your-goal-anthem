namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class OpenLigaDbSettings
{
    public const string SectionName = "OpenLigaDb";
    public bool Enabled { get; init; } = true;
    public string LeagueShortcut { get; init; } = "wm26";
    public int Season { get; init; } = 2026;
    public int RefreshSeconds { get; init; } = 20;
    public int StartDelaySeconds { get; init; }
}
