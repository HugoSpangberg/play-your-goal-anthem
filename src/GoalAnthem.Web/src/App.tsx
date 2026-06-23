import { MatchSetupFlow } from './features/setup/MatchSetupFlow';

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">GoalAnthem</p>
        <h1 id="page-title">Your team scores. Your anthem plays.</h1>
        <p className="intro">
          Pick a match to begin the flow. The demo works without Spotify, paid services, or live provider configuration.
        </p>
      </section>
      <MatchSetupFlow />
    </main>
  );
}
