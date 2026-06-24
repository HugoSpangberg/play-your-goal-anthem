namespace GoalAnthem.Domain.Matches;

public sealed record Team(TeamId Id, string Name, string? CountryCode)
{
    public static Team Create(TeamId id, string name, string? countryCode = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Team name is required.", nameof(name));
        }

        return new Team(id, name.Trim(), NormalizeCountryCode(countryCode));
    }

    private static string? NormalizeCountryCode(string? countryCode)
    {
        if (string.IsNullOrWhiteSpace(countryCode))
        {
            return null;
        }

        var normalized = countryCode.Trim().ToUpperInvariant();
        return normalized.Length == 2 ? normalized : null;
    }
}
