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

describe('DemoMatchList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders selectable demo match cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => demoMatches,
      }),
    );

    render(<DemoMatchList />);

    expect(screen.getByText('Loading demo matches...')).toBeInTheDocument();

    const match = await screen.findByRole('button', { name: /North Harbor FC/i });
    expect(match).toHaveTextContent('Eastgate City');

    await userEvent.click(match);

    expect(match).toHaveTextContent('Selected');
  });

  it('shows an empty state when no matches are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    render(<DemoMatchList />);

    expect(await screen.findByText('No demo matches are available.')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    render(<DemoMatchList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Status: 500');
    });
  });
});
