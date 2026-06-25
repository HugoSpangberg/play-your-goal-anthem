namespace GoalAnthem.Infrastructure.Matches;

internal static class CountryCodeResolver
{
    private static readonly Dictionary<string, string> CodeAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ALG"] = "DZ",
        ["ARG"] = "AR",
        ["AUS"] = "AU",
        ["AUT"] = "AT",
        ["BEL"] = "BE",
        ["BRA"] = "BR",
        ["BIH"] = "BA",
        ["CAN"] = "CA",
        ["COL"] = "CO",
        ["CPV"] = "CV",
        ["CRO"] = "HR",
        ["CIV"] = "CI",
        ["COD"] = "CD",
        ["CZE"] = "CZ",
        ["ECU"] = "EC",
        ["EGY"] = "EG",
        ["ENG"] = "GB",
        ["ESP"] = "ES",
        ["FRA"] = "FR",
        ["GHA"] = "GH",
        ["GER"] = "DE",
        ["HTI"] = "HT",
        ["IRQ"] = "IQ",
        ["IRN"] = "IR",
        ["JPN"] = "JP",
        ["JOR"] = "JO",
        ["KSA"] = "SA",
        ["KOR"] = "KR",
        ["MAR"] = "MA",
        ["MEX"] = "MX",
        ["NED"] = "NL",
        ["NOR"] = "NO",
        ["NZL"] = "NZ",
        ["PAN"] = "PA",
        ["PAR"] = "PY",
        ["POR"] = "PT",
        ["QAT"] = "QA",
        ["RSA"] = "ZA",
        ["SAU"] = "SA",
        ["SAF"] = "ZA",
        ["SCO"] = "GB",
        ["SEN"] = "SN",
        ["SWE"] = "SE",
        ["SUI"] = "CH",
        ["TUN"] = "TN",
        ["TUR"] = "TR",
        ["URU"] = "UY",
        ["USA"] = "US",
        ["UZB"] = "UZ",
        ["WAL"] = "GB"
    };

    private static readonly Dictionary<string, string> NameAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Algeria"] = "DZ",
        ["Argentina"] = "AR",
        ["Australia"] = "AU",
        ["Austria"] = "AT",
        ["Belgium"] = "BE",
        ["Bosnia-Herzegovina"] = "BA",
        ["Brazil"] = "BR",
        ["Canada"] = "CA",
        ["Cape Verde Islands"] = "CV",
        ["Colombia"] = "CO",
        ["Congo DR"] = "CD",
        ["Croatia"] = "HR",
        ["Côte d’Ivoire"] = "CI",
        ["Cote d'Ivoire"] = "CI",
        ["Czech Republic"] = "CZ",
        ["Curaçao"] = "CW",
        ["Curacao"] = "CW",
        ["Czechia"] = "CZ",
        ["DR Congo"] = "CD",
        ["Ecuador"] = "EC",
        ["Egypt"] = "EG",
        ["England"] = "GB",
        ["France"] = "FR",
        ["Ghana"] = "GH",
        ["Germany"] = "DE",
        ["Haiti"] = "HT",
        ["Iran"] = "IR",
        ["Iraq"] = "IQ",
        ["Ivory Coast"] = "CI",
        ["Japan"] = "JP",
        ["Jordan"] = "JO",
        ["Korea Republic"] = "KR",
        ["Morocco"] = "MA",
        ["Mexico"] = "MX",
        ["Netherlands"] = "NL",
        ["New Zealand"] = "NZ",
        ["Norway"] = "NO",
        ["Panama"] = "PA",
        ["Paraguay"] = "PY",
        ["Portugal"] = "PT",
        ["Qatar"] = "QA",
        ["Saudi Arabia"] = "SA",
        ["Scotland"] = "GB",
        ["Senegal"] = "SN",
        ["South Africa"] = "ZA",
        ["South Korea"] = "KR",
        ["Spain"] = "ES",
        ["Sweden"] = "SE",
        ["Switzerland"] = "CH",
        ["Tunisia"] = "TN",
        ["Turkey"] = "TR",
        ["Türkiye"] = "TR",
        ["United States"] = "US",
        ["United States of America"] = "US",
        ["Uruguay"] = "UY",
        ["USA"] = "US",
        ["Uzbekistan"] = "UZ",
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
