import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchSetupFlow } from './MatchSetupFlow';

const demoMatches = [
  {
    id: 'demo-2026-summer-cup-001',
    kickoffTime: '2026-07-04T18:00:00+02:00',
    status: 'playable',
    homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC' },
    awayTeam: { id: 'eastgate-city', name: 'Eastgate City' },
  },
];

describe('MatchSetupFlow', () => {
  let createObjectUrlMock: ReturnType<typeof vi.fn>;
  let revokeObjectUrlMock: ReturnType<typeof vi.fn>;
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectUrlMock = vi.fn(() => `blob:${Math.random().toString(16).slice(2)}`);
    revokeObjectUrlMock = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined) as ReturnType<typeof vi.spyOn>;
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined) as ReturnType<typeof vi.spyOn>;
    stubMatches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves from match selection to team selection and back to matches', async () => {
    render(<MatchSetupFlow />);

    const matchButton = await screen.findByRole('button', { name: /North Harbor FC/i });

    await userEvent.click(matchButton);

    expect(screen.getByRole('heading', { name: 'Which team do you support in this match?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /North Harbor FC/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eastgate City/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to matches' }));

    const returnedMatchButton = await screen.findByRole('button', { name: /North Harbor FC/i });

    expect(screen.getByRole('heading', { name: 'Select a demo match' })).toBeInTheDocument();
    expect(returnedMatchButton).toHaveAttribute('aria-pressed', 'true');
    expect(returnedMatchButton).toHaveTextContent('Selected match');
  });

  it('allows selecting either team and preserves the selection when revisiting the team step', async () => {
    render(<MatchSetupFlow />);

    await userEvent.click(await screen.findByRole('button', { name: /North Harbor FC/i }));

    await userEvent.click(screen.getByRole('button', { name: /Eastgate City/i }));
    expect(screen.getByRole('heading', { name: 'Select a demo anthem or use a local audio file' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to team' }));
    expect(screen.getByRole('button', { name: /Eastgate City/i })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /North Harbor FC/i }));
    expect(screen.getByRole('heading', { name: 'Select a demo anthem or use a local audio file' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to team' }));
    expect(screen.getByRole('button', { name: /North Harbor FC/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets the user choose a local file, use the current playback position, validate the cue, test playback, and reach ready', async () => {
    render(<MatchSetupFlow />);

    await userEvent.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await userEvent.click(screen.getByRole('button', { name: /North Harbor FC/i }));

    const fileInput = screen.getByLabelText('Choose a local audio file');
    const localFile = new File(['local anthem'], 'supporter-anthem.mp3', { type: 'audio/mpeg' });

    await userEvent.upload(fileInput, localFile);

    const audio = await screen.findByLabelText('Preview selected anthem');
    setAudioMetadata(audio as HTMLAudioElement, { currentTime: 27, duration: 125 });
    fireEvent.loadedMetadata(audio);

    await userEvent.click(screen.getByRole('button', { name: 'Use current playback position' }));
    expect(screen.getByLabelText('Start position in mm:ss')).toHaveValue('00:27');

    await userEvent.clear(screen.getByLabelText('Start position in mm:ss'));
    await userEvent.type(screen.getByLabelText('Start position in mm:ss'), '02:10');
    expect(screen.getByRole('alert')).toHaveTextContent('Cue point must be at or before 02:05.');

    await userEvent.clear(screen.getByLabelText('Start position in mm:ss'));
    await userEvent.type(screen.getByLabelText('Start position in mm:ss'), '01:15');

    await userEvent.click(screen.getByRole('button', { name: 'Test anthem' }));
    expect(playSpy).toHaveBeenCalled();
    expect(audio).toHaveProperty('currentTime', 75);

    await userEvent.click(screen.getByRole('button', { name: 'Mark ready' }));

    expect(screen.getByRole('heading', { name: 'Your setup is ready' })).toBeInTheDocument();
    expect(screen.getByText('Match', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('North Harbor FC vs Eastgate City')).toBeInTheDocument();
    expect(screen.getByText('Supported team', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('North Harbor FC')).toBeInTheDocument();
    expect(screen.getByText('Anthem', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('Local file: supporter-anthem.mp3')).toBeInTheDocument();
    expect(screen.getByText('Cue point', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('01:15')).toBeInTheDocument();
  });

  it('stops preview playback and revokes object URLs when navigating back', async () => {
    render(<MatchSetupFlow />);

    await userEvent.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await userEvent.click(screen.getByRole('button', { name: /North Harbor FC/i }));
    await userEvent.click(screen.getByRole('button', { name: /Stadium Pulse/i }));

    expect(screen.getByRole('heading', { name: 'Set where the anthem should begin' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to anthems' }));

    expect(pauseSpy).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Select a demo anthem or use a local audio file' })).toBeInTheDocument();
  });
});

function stubMatches() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => demoMatches,
    }),
  );
}

function setAudioMetadata(audio: HTMLAudioElement, { currentTime, duration }: { currentTime: number; duration: number }) {
  let currentTimeValue = currentTime;

  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => currentTimeValue,
    set: (value: number) => {
      currentTimeValue = value;
    },
  });
  Object.defineProperty(audio, 'duration', {
    configurable: true,
    get: () => duration,
  });
}
