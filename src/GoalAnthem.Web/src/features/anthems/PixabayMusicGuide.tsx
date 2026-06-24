export function PixabayMusicGuide() {
  return (
    <section className="pixabay-guide" aria-labelledby="pixabay-guide-title">
      <div>
        <p className="step-label">Optional discovery</p>
        <h3 id="pixabay-guide-title">Need an anthem?</h3>
      </div>
      <ol className="pixabay-steps">
        <li>Browse Pixabay Music</li>
        <li>Download a track</li>
        <li>Return and upload it above</li>
      </ol>
      <div className="external-link-row">
        <a href="https://pixabay.com/music/" rel="noreferrer noopener" target="_blank">
          Browse Pixabay Music <span className="visually-hidden">(opens in a new tab)</span>
        </a>
        <a href="https://pixabay.com/service/license-summary/" rel="noreferrer noopener" target="_blank">
          Read license summary <span className="visually-hidden">(opens in a new tab)</span>
        </a>
      </div>
      <details>
        <summary>Source details and Content ID note</summary>
        <p>
          GoalAnthem does not connect to Pixabay, download tracks, or verify licenses. Download only from the official Pixabay site,
          keep the source page or download record when possible, and check whether the track has Content ID notes.
        </p>
      </details>
    </section>
  );
}
