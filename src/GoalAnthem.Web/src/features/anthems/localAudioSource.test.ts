import { describe, expect, it } from 'vitest';
import { getSafePixabaySourceUrl, validateLocalAudioFile, validatePixabayMusicUrl } from './localAudioSource';

describe('validatePixabayMusicUrl', () => {
  it.each([
    ['https://pixabay.com/music/example-track-12345/', 'https://pixabay.com/music/example-track-12345/'],
    [' https://www.pixabay.com/music/example-track-12345/ ', 'https://www.pixabay.com/music/example-track-12345/'],
  ])('accepts %s', (input, normalizedUrl) => {
    expect(validatePixabayMusicUrl(input)).toEqual({ isValid: true, normalizedUrl });
  });

  it.each([
    'http://pixabay.com/music/example/',
    'https://pixabay.example.com/music/example/',
    'https://evil.com/pixabay.com/music/example/',
    'https://pixabay.com/images/example/',
    'https://user:pass@pixabay.com/music/example/',
    'not-a-url',
  ])('rejects %s', (input) => {
    expect(validatePixabayMusicUrl(input).isValid).toBe(false);
  });

  it('omits invalid source URLs from safe summaries', () => {
    expect(getSafePixabaySourceUrl({ sourceType: 'pixabay', sourceUrl: 'https://evil.com/pixabay.com/music/example/' })).toBeNull();
  });
});

describe('validateLocalAudioFile', () => {
  it('accepts valid audio files', () => {
    expect(validateLocalAudioFile(new File(['audio'], 'anthem.mp3', { type: 'audio/mpeg' }))).toBeNull();
  });

  it('accepts empty MIME types when the extension is a common audio type', () => {
    expect(validateLocalAudioFile(new File(['audio'], 'anthem.wav', { type: '' }))).toBeNull();
  });

  it('rejects zero-byte files', () => {
    expect(validateLocalAudioFile(new File([], 'empty.mp3', { type: 'audio/mpeg' }))).toBe('Choose an audio file that is not empty.');
  });

  it('rejects non-audio MIME types', () => {
    expect(validateLocalAudioFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(
      'Choose a browser-supported audio file.',
    );
  });
});
