import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchSetupFlow } from './MatchSetupFlow';

const demoMatches = [
  {
    id: 'demo-2026-summer-cup-001',
    kickoffTime: '2026-07-04T18:00:00+02:00',
    status: 'playable',
    homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC', countryCode: 'US' },
    awayTeam: { id: 'eastgate-city', name: 'Eastgate City', countryCode: 'GB' },
  },
  {
    id: 'demo-2026-summer-cup-002',
    kickoffTime: '2026-07-05T20:30:00+02:00',
    status: 'upcoming',
    homeTeam: { id: 'riverside-athletic', name: 'Riverside Athletic', countryCode: 'BR' },
    awayTeam: { id: 'valley-rovers', name: 'Valley Rovers', countryCode: 'JP' },
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

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrlMock });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrlMock });
    playSpy = vi.fn().mockResolvedValue(undefined);
    pauseSpy = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: playSpy });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pauseSpy });
    stubMatches();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses guarded setup navigation and moves focus to selected steps', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    expect(screen.getByRole('button', { name: 'Match: current' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'Team: locked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anthem: locked' })).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: /North Harbor FC versus Eastgate City/i }));

    expect(screen.getByRole('heading', { name: /Choose the team/i })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Match: completed' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Team: current' })).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: 'Match: completed' }));

    expect((await screen.findAllByRole('heading', { name: 'Select a match' })).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /North Harbor FC versus Eastgate City/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows flags in team selection and preserves team/audio choices when navigating backward', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await user.click(await screen.findByRole('button', { name: /North Harbor FC versus Eastgate City/i }));

    expect(screen.getByRole('button', { name: /North Harbor FC/i })).toHaveTextContent('🇺🇸');
    expect(screen.getByRole('button', { name: /Eastgate City/i })).toHaveTextContent('🇬🇧');

    await user.click(screen.getByRole('button', { name: /Eastgate City/i }));
    expect(screen.getByRole('heading', { name: 'Choose your goal anthem' })).toBeInTheDocument();

    await uploadLocalFile(user, 'supporter-anthem.mp3');
    await user.click(screen.getByRole('button', { name: 'Team: completed' }));
    expect(screen.getByRole('button', { name: /Eastgate City/i })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Anthem: available' }));
    expect(screen.getByText('supporter-anthem.mp3')).toBeInTheDocument();
  });

  it('clears downstream choices when changing match and when replacing the local file', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await completeReadySetup(user);
    await user.click(screen.getByRole('button', { name: 'Match: completed' }));
    await user.click(await screen.findByRole('button', { name: /Riverside Athletic versus Valley Rovers/i }));

    expect(screen.getByRole('button', { name: 'Anthem: locked' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Riverside Athletic/i }));
    await uploadLocalFile(user, 'first.mp3');
    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));
    await user.click(screen.getByRole('button', { name: 'Save cue point' }));
    await user.click(screen.getByRole('button', { name: 'Anthem: completed' }));
    await uploadLocalFile(user, 'second.mp3');

    expect(screen.getByRole('button', { name: 'Ready: locked' })).toBeDisabled();
  });

  it('renders local-file-first anthem selection with optional Pixabay metadata and no generated demo cards', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await user.click(screen.getByRole('button', { name: /North Harbor FC/i }));

    expect(screen.getByRole('heading', { name: 'Choose your goal anthem' })).toBeInTheDocument();
    expect(screen.queryByText('Stadium Pulse')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to cue point' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Need an anthem?' })).toBeInTheDocument();
    expect(screen.getByText('Return and upload it above')).toBeInTheDocument();

    await uploadLocalFile(user, 'pixabay-anthem.wav', 'audio/wav');
    await user.click(screen.getByLabelText('Downloaded from Pixabay'));
    expect(screen.getByLabelText('Track title')).not.toBeVisible();
    await user.click(screen.getByText('Source details and license notes'));
    await user.type(screen.getByLabelText('Track title'), 'Victory Crowd');
    await user.type(screen.getByLabelText('Creator or contributor'), 'Demo Creator');
    await user.type(screen.getByLabelText('Original Pixabay music-page URL'), 'https://evil.com/pixabay.com/music/example/');

    expect(screen.getByRole('alert')).toHaveTextContent('Use a pixabay.com music page URL.');

    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));
    await user.click(screen.getByRole('button', { name: 'Save cue point' }));

    expect(screen.getByRole('heading', { name: 'Ready for kickoff' })).toBeInTheDocument();
    expect(screen.getByText('Victory Crowd · Demo Creator')).toBeInTheDocument();
  });

  it('rejects invalid local files and revokes object URLs when replacing files or leaving preview', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await user.click(screen.getByRole('button', { name: /North Harbor FC/i }));

    await user.upload(screen.getByLabelText('Choose a local audio file'), new File([], 'empty.mp3', { type: 'audio/mpeg' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an audio file that is not empty.');

    await uploadLocalFile(user, 'first.mp3');
    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));
    expect(await screen.findByLabelText('Preview selected anthem')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anthem: completed' }));
    await uploadLocalFile(user, 'second.mp3');
    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('synchronizes slider and time input, previews from cue, and saves the cue point', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await user.click(screen.getByRole('button', { name: /North Harbor FC/i }));
    await uploadLocalFile(user, 'supporter-anthem.mp3');
    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));

    const audio = await screen.findByLabelText('Preview selected anthem');
    setAudioMetadata(audio as HTMLAudioElement, { currentTime: 27, duration: 125 });
    fireEvent.loadedMetadata(audio);

    fireEvent.change(screen.getByLabelText('Cue position'), { target: { value: '12' } });
    expect(screen.getByLabelText('Exact time in mm:ss')).toHaveValue('00:12');

    await user.click(screen.getByRole('button', { name: 'Use current position' }));
    expect(screen.getByLabelText('Exact time in mm:ss')).toHaveValue('00:27');

    await user.clear(screen.getByLabelText('Exact time in mm:ss'));
    await user.type(screen.getByLabelText('Exact time in mm:ss'), '02:10');
    expect(screen.getByRole('alert')).toHaveTextContent('Cue point must be at or before 02:05.');

    await user.clear(screen.getByLabelText('Exact time in mm:ss'));
    await user.type(screen.getByLabelText('Exact time in mm:ss'), '01:15');
    await user.click(screen.getByRole('button', { name: 'Preview from 01:15' }));

    expect(playSpy).toHaveBeenCalled();
    expect(audio).toHaveProperty('currentTime', 75);

    await user.click(screen.getByRole('button', { name: 'Save cue point' }));
    expect(screen.getByRole('heading', { name: 'Ready for kickoff' })).toBeInTheDocument();
    expect(screen.getByText('Cue point: 01:15')).toBeInTheDocument();
  });

  it('shows Ready flags, TV synchronization guidance, normal speed default, and explicit start CTA', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await completeReadySetup(user);

    expect(screen.getByText('Ready for kickoff')).toBeInTheDocument();
    expect(screen.getAllByText('🇺🇸').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🇬🇧').length).toBeGreaterThan(0);
    expect(screen.getByText('Press start when kickoff visibly happens.')).toBeInTheDocument();
    expect(screen.getByText('Do not use the scheduled time.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start when kickoff happens on TV' })).toBeInTheDocument();
    expect(screen.getByLabelText('Use 15x demo speed')).not.toBeChecked();
  });

  it('starts local fallback match mode with flags, supported-team marker, manual playback, stop, and cleanup', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await completeReadySetup(user);
    await user.click(screen.getByText('Testing'));
    await user.click(screen.getByLabelText('Use 15x demo speed'));
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    await startLocalFallbackMatchMode();

    expect(screen.getByRole('heading', { name: 'Follow the match' })).toBeInTheDocument();
    expect(screen.getByText('Your team')).toBeInTheDocument();
    expect(screen.getByText('● Local simulation')).toBeInTheDocument();
    expect(screen.getByText('Testing · 15x')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(screen.getByText('North Harbor FC goal')).toBeInTheDocument();
    expect(screen.getByText('Playing anthem')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play anthem manually' }));
    expect(playSpy).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Stop anthem' }));
    expect(screen.getByText('Anthem stopped')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'End match mode' }));
    expect(screen.getByRole('heading', { name: 'Ready for kickoff' })).toBeInTheDocument();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
  });

  it('keeps opponent goals from playing audio and avoids engine restarts across renders', async () => {
    const user = userEvent.setup();
    render(<MatchSetupFlow />);

    await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
    await user.click(screen.getByRole('button', { name: /Eastgate City/i }));
    await uploadLocalFile(user, 'supporter-anthem.mp3');
    await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));
    await user.click(screen.getByRole('button', { name: 'Save cue point' }));
    await user.click(screen.getByText('Testing'));
    await user.click(screen.getByLabelText('Use 15x demo speed'));

    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    await startLocalFallbackMatchMode();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(56_000);
    });

    expect(screen.getByText('North Harbor FC goal')).toBeInTheDocument();
    expect(playSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(208_000);
    });

    expect(screen.getByText('Eastgate City goal')).toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });
});

function stubMatches() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes('/api/match-sessions')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ title: 'Match sessions unavailable' }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          matches: demoMatches,
          source: 'demo',
          fetchedAt: '2026-06-23T12:00:00Z',
          isFallback: true,
          message: 'Demo data is shown because live World Cup data is not configured.',
        }),
      };
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
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => duration });
}

async function uploadLocalFile(user: ReturnType<typeof userEvent.setup>, name: string, type = 'audio/mpeg') {
  await user.upload(screen.getByLabelText('Choose a local audio file'), new File(['local anthem'], name, { type }));
}

async function completeReadySetup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /North Harbor FC/i }));
  await user.click(screen.getByRole('button', { name: /North Harbor FC/i }));
  await uploadLocalFile(user, 'supporter-anthem.mp3');
  await user.click(screen.getByRole('button', { name: 'Continue to cue point' }));
  await user.click(screen.getByRole('button', { name: 'Save cue point' }));
}

async function startLocalFallbackMatchMode() {
  fireEvent.click(screen.getByRole('button', { name: 'Start when kickoff happens on TV' }));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.getByRole('heading', { name: 'Remote match mode is unavailable' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Use local demo mode' }));
}
