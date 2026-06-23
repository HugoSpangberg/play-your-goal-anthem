namespace GoalAnthem.Domain.Matches;

public readonly record struct MatchSessionId
{
    public MatchSessionId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Match session ID is required.", nameof(value));
        }

        Value = value.Trim();
    }

    public string Value { get; }

    public override string ToString() => Value;
}
