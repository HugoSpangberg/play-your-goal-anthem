namespace GoalAnthem.Infrastructure.LiveMatches;

public sealed class ApiFootballSettings
{
    public const string SectionName = "ApiFootball";
    public bool Enabled { get; init; } = true;
    public string? AccessValue { get; init; }
    public int RefreshSeconds { get; init; } = 75;
    public int StartDelaySeconds { get; init; } = 17;
    public int DailyLimit { get; init; } = 100;
    public int SafetyReserve { get; init; } = 4;
}
