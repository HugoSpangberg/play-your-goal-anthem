import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoMatchList } from './DemoMatchList';

const demoMatches = [
  {
    id: 'demo-2026-summer-cup-001',
    kickoffTime: '2026-07-04T18:00:00+02:00',
    status: 'playable',
    homeTeam: { id: 'north-harbor-fc', name: 'North Harbor FC' },
    awayTeam: { id: 'eastgate-city', name: 'Eastgate City' },
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

  it('renders selectable match cards with demo source and calls the explicit selection callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => demoResponse,
      }),
    );
    const onMatchSelect = vi.fn();

    render(<DemoMatchList onMatchSelect={onMatchSelect} />);

    expect(screen.getByText('Loading matches...')).toBeInTheDocument();

    const match = await screen.findByRole('button', { name: /North Harbor FC/i });
    expect(match).toHaveTextContent('Eastgate City');
    expect(screen.getAllByText(/Demo data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/World Cup API data is not configured/i)).toBeInTheDocument();

    await userEvent.click(match);

    expect(onMatchSelect).toHaveBeenCalledWith(demoMatches[0]);
  });

  it('renders World Cup API source metadata without claiming real-time data', async () => {
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

    expect(await screen.findByText(/World Cup API data/i)).toBeInTheDocument();
    expect(screen.queryByText(/Live World Cup data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fallback data/i)).not.toBeInTheDocument();
  });

  it('refreshes matches without allowing request spam', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => demoResponse,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    ...demoResponse,
                    fetchedAt: '2026-06-23T12:01:00Z',
                  }),
                }),
              20,
            );
          }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    const refreshButton = await screen.findByRole('button', { name: 'Refresh matches' });
    await userEvent.click(refreshButton);

    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveTextContent('Refreshing...');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0].toString()).toContain('refresh=true');
  });

  it('shows an empty state when no matches are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...demoResponse,
          matches: [],
        }),
      }),
    );

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    expect(await screen.findByText('No matches are available from this source.')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    render(<DemoMatchList onMatchSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Status: 500');
    });
  });
});
