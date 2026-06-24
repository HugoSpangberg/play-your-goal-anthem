import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { getSourceTypeLabel, type LocalAudioSourceMetadata } from '../anthems/localAudioSource';

export type AnthemSelection = { kind: 'local'; file: File; source?: LocalAudioSourceMetadata };

type PreviewState = {
  audioUrl: string;
  label: string;
  durationSeconds: number | null;
  sourceLabel: string;
};

export function useAnthemPreview(selection: AnthemSelection | undefined) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (!selection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return undefined;
    }

    const source = {
      audioUrl: URL.createObjectURL(selection.file),
      label: selection.file.name,
      durationSeconds: null,
      sourceLabel: getSourceTypeLabel(selection.source?.sourceType ?? 'local'),
    };

    setPreview(source);

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      URL.revokeObjectURL(source.audioUrl);
    };
  }, [selection]);

  const durationSeconds = preview?.durationSeconds ?? null;

  function handleLoadedMetadata(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;

    if (Number.isFinite(audio.duration)) {
      setPreview((current) =>
        current
          ? {
              ...current,
              durationSeconds: Math.max(0, Math.floor(audio.duration)),
            }
          : current,
      );
    }
  }

  const playFromCue = useCallback(async (cuePointSeconds: number) => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = cuePointSeconds;

    try {
      await audio.play();
    } catch {
      // Browsers can reject autoplay. The UI already exposes the error-free preview control.
    }
  }, []);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, []);

  return {
    audioRef,
    durationSeconds,
    handleLoadedMetadata,
    playFromCue,
    preview,
    stopPreview,
  };
}
