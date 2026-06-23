import { act, fireEvent, render, screen } from '@testing-library/react';
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
  let playSpy: ReturnType<typeof vi.fn>;
  let pauseSpy: ReturnType<typeof vi.fn>;

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
    playSpy = vi.fn().mockResolvedValue(undefined);
    pauseSpy = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playSpy,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseSpy,
    });
    stubMatches();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(screen.getByRole('heading', { name: 'Select a match' })).toBeInTheDocument();
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

  it('starts match mode from Ready and plays the anthem for a supported-team goal', async () => {
    const user = userEvent.setup();

    await completeDemoSetup(user, 'North Harbor FC');

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

    expect(screen.getByRole('heading', { name: 'Match mode' })).toBeInTheDocument();
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getAllByText("0'").length).toBeGreaterThan(0);
    expect(screen.getByText("Synchronized at 0' from local kickoff.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(screen.getAllByText("14'").length).toBeGreaterThan(0);
    expect(screen.getByText('North Harbor FC goal')).toBeInTheDocument();
    expect(screen.getByText('1-0')).toBeInTheDocument();
    expect(screen.getByText('Playing anthem for North Harbor FC goal.')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Match anthem playback')).toHaveProperty('currentTime', 0);
  });

  it('does not play the anthem for opponent goals and supports manual playback', async () => {
    const user = userEvent.setup();

    await completeDemoSetup(user, 'Eastgate City');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(screen.getByText('North Harbor FC goal')).toBeInTheDocument();
    expect(screen.queryByText('Playing anthem for North Harbor FC goal.')).not.toBeInTheDocument();
    expect(playSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Goal! Play anthem now' }));

    expect(screen.getByText('Manual goal playback started.')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it('supports normal speed and stop playback controls', async () => {
    const user = userEvent.setup();

    await completeDemoSetup(user, 'North Harbor FC');
    await user.click(screen.getByLabelText('Normal speed (1x)'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getAllByText("1'").length).toBeGreaterThan(0);
    expect(playSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Goal! Play anthem now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop anthem' }));

    expect(screen.getByText('Anthem stopped.')).toBeInTheDocument();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('cleans up audio and timers when leaving match mode', async () => {
    const user = userEvent.setup();

    await completeDemoSetup(user, 'North Harbor FC');
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match mode' }));

    expect(screen.getByRole('heading', { name: 'Your setup is ready' })).toBeInTheDocument();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
  });

  it('does not restart the match engine when snapshot updates trigger rerenders', async () => {
    const user = userEvent.setup();

    await completeDemoSetup(user, 'North Harbor FC');

    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }));

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getAllByText('Kickoff')).toHaveLength(1);
    expect(screen.getAllByText('North Harbor FC goal')).toHaveLength(1);
    expect(playSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getAllByText('Kickoff')).toHaveLength(1);
    expect(screen.getAllByText('North Harbor FC goal')).toHaveLength(1);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });
});

function stubMatches() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: demoMatches,
        source: 'demo',
        fetchedAt: '2026-06-23T12:00:00Z',
        isFallback: true,
        message: 'Demo data is shown because live World Cup data is not configured.',
      }),
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

async function completeDemoSetup(user: ReturnType<typeof userEvent.setup>, teamName: 'North Harbor FC' | 'Eastgate City') {
  render(<MatchSetupFlow />);

  await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
  await user.click(screen.getByRole('button', { name: new RegExp(teamName, 'i') }));
  await user.click(screen.getByRole('button', { name: /Stadium Pulse/i }));
  await user.click(screen.getByRole('button', { name: 'Mark ready' }));
}
