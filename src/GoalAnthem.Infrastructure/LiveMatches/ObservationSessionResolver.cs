using GoalAnthem.Application.LiveMatches;
using GoalAnthem.Application.Matches.GetMatches;

namespace GoalAnthem.Infrastructure.LiveMatches;

internal static class ObservationSessionResolver
{
    public static LiveMatchTarget? Resolve(IReadOnlyList<LiveMatchTarget> sessions, LiveMatchObservation observation)
    {
        foreach (var session in sessions.OrderBy(item => Math.Abs((item.Match.KickoffTime - observation.KickoffTime).TotalMinutes)))
        {
            if ((session.Match.KickoffTime - observation.KickoffTime).Duration() > TimeSpan.FromHours(18))
            {
                continue;
            }

            if (SameTeam(session.Match.HomeTeam, observation.HomeCountryCode, observation.HomeTeamName) &&
                SameTeam(session.Match.AwayTeam, observation.AwayCountryCode, observation.AwayTeamName))
            {
                return session;
            }
        }

        return null;
    }

    private static bool SameTeam(TeamDto team, string? countryCode, string name)
    {
        if (!string.IsNullOrWhiteSpace(team.CountryCode) &&
            !string.IsNullOrWhiteSpace(countryCode) &&
            string.Equals(team.CountryCode, countryCode, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return string.Equals(Normalize(team.Name), Normalize(name), StringComparison.Ordinal);
    }

    private static string Normalize(string value) =>
        string.Concat(value.Where(char.IsLetterOrDigit)).ToUpperInvariant();
}
