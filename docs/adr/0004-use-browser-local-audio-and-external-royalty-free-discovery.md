# ADR 0004: Use Browser-Local Audio And External Royalty-Free Discovery

## Status

Accepted.

## Context

GoalAnthem needs reliable automatic goal playback during a TV match. Streaming-service control adds account, entitlement, policy, autoplay, synchronization, and token-handling complexity that does not improve the free portfolio demo.

Pixabay Music can help users discover royalty-free music, but Pixabay does not provide a documented public music API for this product. Scraping, proxying, reverse-engineering download URLs, or pretending an API exists would create fragile and misleading behavior.

## Decision

Use browser-local audio as the automatic-playback boundary.

Supported automatic anthem sources are deterministic demo audio and user-imported local audio files. A user may open the official Pixabay Music website in a separate tab, download a track directly from Pixabay, return to GoalAnthem, and import that downloaded file through the browser file picker.

GoalAnthem may store optional source metadata in React state for the current browser session, such as title, creator, source URL, download date, and Content ID notes. This metadata is a user-maintained source record, not license verification.

GoalAnthem does not implement a Pixabay API client, backend proxy, scraper, embedded site, account flow, direct download flow, or streaming player.

## Consequences

- The main demo remains free and works without music APIs, accounts, secrets, or paid services.
- Local files and source metadata stay in the browser and are not sent to backend match-session APIs or SignalR.
- Imported audio can work offline after selection and is not dependent on a streaming provider during match mode.
- Users remain responsible for checking current track and license information and keeping source/download records.
- Future external music integrations must preserve the automatic-playback boundary or introduce a new ADR.
