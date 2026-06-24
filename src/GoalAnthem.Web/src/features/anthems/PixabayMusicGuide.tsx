export function PixabayMusicGuide() {
  return (
    <section className="pixabay-guide" aria-labelledby="pixabay-guide-title">
      <div>
        <p className="step-label">Optional discovery</p>
        <h4 id="pixabay-guide-title">Find royalty-free music</h4>
      </div>
      <p>
        GoalAnthem does not connect to Pixabay, download tracks, or verify licenses. Open Pixabay Music in a new tab, review the
        current track and license information, download directly from Pixabay, then return here and import the audio file.
      </p>
      <p>
        Imported files stay in this browser and are never uploaded. Keep the source URL or download record when possible, and note
        that some tracks may be registered with Content ID.
      </p>
      <div className="external-link-row">
        <a href="https://pixabay.com/music/" rel="noreferrer noopener" target="_blank">
          Browse Pixabay Music <span className="visually-hidden">(opens in a new tab)</span>
        </a>
        <a href="https://pixabay.com/service/license-summary/" rel="noreferrer noopener" target="_blank">
          Read Pixabay Content License <span className="visually-hidden">(opens in a new tab)</span>
        </a>
      </div>
    </section>
  );
}
