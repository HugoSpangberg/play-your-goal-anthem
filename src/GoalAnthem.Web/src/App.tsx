import { DemoMatchList } from './features/matches/DemoMatchList';

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">GoalAnthem</p>
        <h1 id="page-title">Your team scores. Your anthem plays.</h1>
        <p className="intro">
          Pick a deterministic demo match to begin the flow. Spotify and live data are intentionally not required for this demo.
        </p>
      </section>
      <DemoMatchList />
    </main>
  );
}
