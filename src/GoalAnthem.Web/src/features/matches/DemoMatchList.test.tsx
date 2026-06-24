import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoMatchList } from './DemoMatchList';

const demoMatches = [
  {
    id: 'demo-2026-summer-cup-002',
    kickoffTime: '2026-07-05T20:30:00+02:00',
    status: 'upcoming',
    homeTeam: { id: 'riverside-athletic', name: 'Riverside Athletic', countryCode: 'BR' },
    awayTeam: { id: 'valley-rovers', name: 'Valley Rovers', countryCode: 'JP' },
  },
  {
    id: 'demo-2026-summer-cup-001',
    kickoffTime: '2026-07-04T18:00:00+02:00',
    status: 'playable',
    homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC', countryCode: 'US' },
    awayTeam: { id: 'eastgate-city', name: 'Eastgate City', countryCode: 'GB' },
  },
];

const demoResponse = {
  matches: demoMatches,
  source: 'demo',
  fetchedAt: '2026-06-23T12:00:00Z',
  isFallback: true,
  message: 'Demo data is shown because World Cup API data is not configured.',
};

describe('DemoMatchList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders grouped selectable match cards with flags and source metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => demoResponse }));
    const onMatchSelect = vi.fn();

    render(<DemoMatchList onMatchSelect={onMatchSelect} />);

    expect(screen.getByLabelText('Loading matches')).toBeInTheDocument();

    const match = await screen.findByRole('button', { name: /North Harbor FC versus Eastgate City/i });
    expect(screen.getByText('Demo fixtures')).toBeInTheDocument();
    expect(screen.getByText(/World Cup API data is not configured/i)).toBeInTheDocument();
    expect(screen.getByText('Saturday, July 4')).toBeInTheDocument();
    expect(screen.getByText('Sunday, July 5')).toBeInTheDocument();
    const matchFlagImages = match.querySelectorAll('.country-flag img');
    expect(matchFlagImages).toHaveLength(2);
    expect(matchFlagImages[0]?.getAttribute('src')).toContain('image/svg+xml');
    expect(matchFlagImages[0]?.getAttribute('src')).not.toMatch(/^https?:\/\//);
    expect(match).not.toHaveTextContent('🇺🇸');
    expect(match).not.toHaveTextContent('🇬🇧');

    await userEvent.click(match);

    expect(onMatchSelect).toHaveBeenCalledWith(demoMatches[1]);
  });

  it('searches by either team name without extra backend requests and shows an empty search state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => demoResponse });
    vi.stubGlobal('fetch', fetchMock);

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    await screen.findByRole('button', { name: /North Harbor FC/i });
    await userEvent.type(screen.getByLabelText('Search country'), 'valley');

    expect(screen.queryByRole('button', { name: /North Harbor FC/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Riverside Athletic/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await userEvent.clear(screen.getByLabelText('Search country'));
    await userEvent.type(screen.getByLabelText('Search country'), 'zzzz');

    expect(screen.getByText('No matches found for “zzzz”.')).toBeInTheDocument();
  });

  it('renders World Cup source metadata without claiming real-time data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...demoResponse,
          source: 'liveWorldCup',
          isFallback: false,
          message: null,
        }),
      }),
    );

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    expect(await screen.findByText('World Cup fixtures')).toBeInTheDocument();
    expect(screen.queryByText(/Live World Cup data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fallback data/i)).not.toBeInTheDocument();
  });

  it('refreshes matches without allowing request spam', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => demoResponse })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: async () => ({ ...demoResponse, fetchedAt: '2026-06-23T12:01:00Z' }) }), 20);
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    const refreshButton = await screen.findByRole('button', { name: 'Refresh' });
    await userEvent.click(refreshButton);

    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveTextContent('Refreshing...');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].toString()).toContain('refresh=true');
  });

  it('shows empty and error states', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ...demoResponse, matches: [] }) }));

    const { unmount } = render(<DemoMatchList onMatchSelect={vi.fn()} />);
    expect(await screen.findByText('No matches are available from this source.')).toBeInTheDocument();
    unmount();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Status: 500');
    });
  });
});
