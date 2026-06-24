export type LocalAudioSourceMetadata = {
  sourceType: 'local' | 'pixabay';
  title?: string;
  creator?: string;
  sourceUrl?: string;
  downloadedOn?: string;
  licenseNote?: string;
};

export type PixabayUrlValidation =
  | { isValid: true; normalizedUrl: string }
  | { isValid: false; message: string };

const maxLocalAudioFileSizeBytes = 50 * 1024 * 1024;
const supportedAudioExtensions = ['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm'];

export function validatePixabayMusicUrl(value: string): PixabayUrlValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { isValid: false, message: 'Enter the original Pixabay music page URL, or leave it blank.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { isValid: false, message: 'Enter a valid URL.' };
  }

  if (url.protocol !== 'https:') {
    return { isValid: false, message: 'Use an HTTPS Pixabay URL.' };
  }

  if (url.username || url.password) {
    return { isValid: false, message: 'Remove credentials from the URL.' };
  }

  if (url.hostname !== 'pixabay.com' && url.hostname !== 'www.pixabay.com') {
    return { isValid: false, message: 'Use a pixabay.com music page URL.' };
  }

  if (!url.pathname.startsWith('/music/') || url.pathname === '/music/') {
    return { isValid: false, message: 'Use a Pixabay music page URL.' };
  }

  url.hash = '';
  return { isValid: true, normalizedUrl: url.toString() };
}

export function validateLocalAudioFile(file: File | undefined): string | null {
  if (!file) {
    return 'Choose an audio file.';
  }

  if (file.size <= 0) {
    return 'Choose an audio file that is not empty.';
  }

  if (file.size > maxLocalAudioFileSizeBytes) {
    return 'Choose an audio file smaller than 50 MB.';
  }

  if (file.type && !file.type.startsWith('audio/')) {
    return 'Choose a browser-supported audio file.';
  }

  if (!file.type && !supportedAudioExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
    return 'Choose a file with a common audio extension, such as MP3, WAV, M4A, OGG, or FLAC.';
  }

  return null;
}

export function getSourceTypeLabel(sourceType: LocalAudioSourceMetadata['sourceType']) {
  return sourceType === 'pixabay' ? 'Pixabay download' : 'Local file';
}

export function getSafePixabaySourceUrl(metadata: LocalAudioSourceMetadata | undefined) {
  if (!metadata?.sourceUrl) {
    return null;
  }

  const validation = validatePixabayMusicUrl(metadata.sourceUrl);
  return validation.isValid ? validation.normalizedUrl : null;
}
