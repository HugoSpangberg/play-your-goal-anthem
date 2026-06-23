export type DemoAnthem = {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
};

export const demoAnthems: readonly DemoAnthem[] = [
  {
    id: 'stadium-pulse',
    name: 'Stadium Pulse',
    description: 'A bright, steady build for a confident matchday cue.',
    durationSeconds: 52,
  },
  {
    id: 'final-whistle-echo',
    name: 'Final Whistle Echo',
    description: 'A slightly longer anthem with a clean open and stronger middle.',
    durationSeconds: 64,
  },
  {
    id: 'north-stand-chorus',
    name: 'North Stand Chorus',
    description: 'A short, punchy demo anthem with a firm intro.',
    durationSeconds: 45,
  },
];

export function getDemoAnthemById(anthemId: string) {
  return demoAnthems.find((anthem) => anthem.id === anthemId);
}

export function createDemoAnthemBlob(anthem: DemoAnthem) {
  const sampleRate = 22_050;
  const samples = Math.floor(sampleRate * anthem.durationSeconds);
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples * bytesPerSample, true);

  const pattern = getPattern(anthem.id);

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const beat = time * pattern.tempoBpm / 60;
    const envelope = Math.sin(Math.min(Math.PI, beat * Math.PI)) ** 2;
    const pulse = Math.sin(2 * Math.PI * pattern.baseFrequency * time);
    const sparkle = Math.sin(2 * Math.PI * pattern.harmonyFrequency * time) * 0.35;
    const accent = Math.sin(2 * Math.PI * pattern.rhythmFrequency * time * 2) * 0.15;
    const sample = Math.max(-1, Math.min(1, (pulse * 0.7 + sparkle + accent) * (0.55 + envelope * 0.45)));
    view.setInt16(44 + index * bytesPerSample, Math.round(sample * 0x7fff), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getPattern(anthemId: string) {
  switch (anthemId) {
    case 'final-whistle-echo':
      return {
        tempoBpm: 108,
        baseFrequency: 196,
        harmonyFrequency: 294,
        rhythmFrequency: 2.2,
      };
    case 'north-stand-chorus':
      return {
        tempoBpm: 118,
        baseFrequency: 247,
        harmonyFrequency: 370,
        rhythmFrequency: 1.8,
      };
    default:
      return {
        tempoBpm: 112,
        baseFrequency: 220,
        harmonyFrequency: 330,
        rhythmFrequency: 2,
      };
  }
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
