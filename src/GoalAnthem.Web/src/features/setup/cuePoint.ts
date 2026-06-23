export function parseCuePointInput(value: string, maximumSeconds: number | null) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return {
      cuePointSeconds: null,
      error: 'Enter a cue point in mm:ss format.',
    };
  }

  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);

  if (!match) {
    return {
      cuePointSeconds: null,
      error: 'Use mm:ss with seconds from 00 to 59.',
    };
  }

  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const cuePointSeconds = minutes * 60 + seconds;

  if (cuePointSeconds < 0) {
    return {
      cuePointSeconds: null,
      error: 'Cue points cannot be negative.',
    };
  }

  if (maximumSeconds !== null && cuePointSeconds > maximumSeconds) {
    return {
      cuePointSeconds: null,
      error: `Cue point must be at or before ${formatCuePoint(maximumSeconds)}.`,
    };
  }

  return {
    cuePointSeconds,
    error: undefined,
  };
}

export function formatCuePoint(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
