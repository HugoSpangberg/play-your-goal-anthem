# Security

Do not commit credentials, tokens, generated secrets, local audio files, or private provider data.

Spotify Client IDs may be public frontend configuration, but Spotify client secrets, access tokens, refresh tokens, authorization codes, PKCE verifiers, and real user identifiers must never be committed. The backend must never receive Spotify tokens or local audio files.

This project currently has no production deployment and no authentication surface. Report security concerns by opening a private advisory when the repository hosting supports it, or by contacting the repository owner directly.
