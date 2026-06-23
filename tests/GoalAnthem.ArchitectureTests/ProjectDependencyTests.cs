using System.Xml.Linq;

namespace GoalAnthem.ArchitectureTests;

public sealed class ProjectDependencyTests
{
    private static readonly string RepositoryRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));

    [Fact]
    public void DomainReferencesNoProjects()
    {
        var references = GetProjectReferences("src/GoalAnthem.Domain/GoalAnthem.Domain.csproj");

        Assert.Empty(references);
    }

    [Fact]
    public void ApplicationOnlyReferencesDomain()
    {
        var references = GetProjectReferences("src/GoalAnthem.Application/GoalAnthem.Application.csproj");

        Assert.Equal(["../GoalAnthem.Domain/GoalAnthem.Domain.csproj"], references);
    }

    [Fact]
    public void InfrastructureReferencesApplicationAndDomain()
    {
        var references = GetProjectReferences("src/GoalAnthem.Infrastructure/GoalAnthem.Infrastructure.csproj");

        Assert.Equal(
            [
                "../GoalAnthem.Application/GoalAnthem.Application.csproj",
                "../GoalAnthem.Domain/GoalAnthem.Domain.csproj"
            ],
            references);
    }

    [Fact]
    public void ApiDoesNotReferenceDomainDirectly()
    {
        var references = GetProjectReferences("src/GoalAnthem.Api/GoalAnthem.Api.csproj");

        Assert.DoesNotContain("../GoalAnthem.Domain/GoalAnthem.Domain.csproj", references);
    }

    private static string[] GetProjectReferences(string relativePath)
    {
        var projectPath = Path.Combine(RepositoryRoot, relativePath);
        var document = XDocument.Load(projectPath);

        return document
            .Descendants("ProjectReference")
            .Select(reference => reference.Attribute("Include")?.Value)
            .Where(value => value is not null)
            .Cast<string>()
            .Order(StringComparer.Ordinal)
            .ToArray();
    }
}
