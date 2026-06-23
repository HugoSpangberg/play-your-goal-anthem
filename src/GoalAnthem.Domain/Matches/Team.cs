namespace GoalAnthem.Domain.Matches;

public sealed record Team(TeamId Id, string Name)
{
    public static Team Create(TeamId id, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Team name is required.", nameof(name));
        }

        return new Team(id, name.Trim());
    }
}
