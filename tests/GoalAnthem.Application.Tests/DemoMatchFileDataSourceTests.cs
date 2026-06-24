using GoalAnthem.Infrastructure.DemoMatches;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace GoalAnthem.Application.Tests;

public sealed class DemoMatchFileDataSourceTests
{
    [Fact]
    public async Task GetDemoMatchesAsyncParsesVersionControlledDemoMatches()
    {
        var contentRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../..", "demo/matches"));
        var dataSource = new DemoMatchFileDataSource(
            new TestHostEnvironment(contentRoot),
            NullLogger<DemoMatchFileDataSource>.Instance);

        var matches = await dataSource.GetDemoMatchesAsync(CancellationToken.None);

        Assert.Equal(3, matches.Count);
        Assert.Equal("demo-2026-summer-cup-001", matches[0].Id.Value);
        Assert.Equal("North Harbor FC", matches[0].HomeTeam.Name);
        Assert.Equal("US", matches[0].HomeTeam.CountryCode);
        Assert.Equal("GB", matches[0].AwayTeam.CountryCode);
    }

    private sealed class TestHostEnvironment(string contentRootPath) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;

        public string ApplicationName { get; set; } = "GoalAnthem.Tests";

        public string ContentRootPath { get; set; } = contentRootPath;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
