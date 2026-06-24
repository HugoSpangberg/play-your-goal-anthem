namespace GoalAnthem.Infrastructure.Matches;

internal static class CountryCodeResolver
{
    private static readonly Dictionary<string, string> CodeAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["BRA"] = "BR",
        ["CAN"] = "CA",
        ["CIV"] = "CI",
        ["COD"] = "CD",
        ["CZE"] = "CZ",
        ["ENG"] = "GB",
        ["FRA"] = "FR",
        ["GER"] = "DE",
        ["JPN"] = "JP",
        ["KOR"] = "KR",
        ["MEX"] = "MX",
        ["SCO"] = "GB",
        ["SUI"] = "CH",
        ["TUR"] = "TR",
        ["USA"] = "US",
        ["WAL"] = "GB"
    };

    private static readonly Dictionary<string, string> NameAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Bosnia-Herzegovina"] = "BA",
        ["Brazil"] = "BR",
        ["Canada"] = "CA",
        ["Cape Verde Islands"] = "CV",
        ["Congo DR"] = "CD",
        ["Côte d’Ivoire"] = "CI",
        ["Cote d'Ivoire"] = "CI",
        ["Curaçao"] = "CW",
        ["Curacao"] = "CW",
        ["Czechia"] = "CZ",
        ["DR Congo"] = "CD",
        ["England"] = "GB",
        ["France"] = "FR",
        ["Germany"] = "DE",
        ["Ivory Coast"] = "CI",
        ["Japan"] = "JP",
        ["Korea Republic"] = "KR",
        ["Mexico"] = "MX",
        ["Scotland"] = "GB",
        ["South Korea"] = "KR",
        ["Switzerland"] = "CH",
        ["Turkey"] = "TR",
        ["Türkiye"] = "TR",
        ["United States"] = "US",
        ["United States of America"] = "US",
        ["USA"] = "US",
        ["Wales"] = "GB"
    };

    public static string? Resolve(string? footballCode, string? teamName)
    {
        var normalizedCode = NormalizeCode(footballCode);
        if (normalizedCode is not null)
        {
            return normalizedCode;
        }

        if (!string.IsNullOrWhiteSpace(teamName) && NameAliases.TryGetValue(teamName.Trim(), out var countryCode))
        {
            return countryCode;
        }

        return null;
    }

    private static string? NormalizeCode(string? footballCode)
    {
        if (string.IsNullOrWhiteSpace(footballCode))
        {
            return null;
        }

        var normalized = footballCode.Trim().ToUpperInvariant();
        if (normalized.Length == 2)
        {
            return normalized;
        }

        return CodeAliases.GetValueOrDefault(normalized);
    }
}
