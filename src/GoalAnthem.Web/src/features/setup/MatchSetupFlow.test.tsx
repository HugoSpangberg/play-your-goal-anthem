import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens team selection after match selection and shows both teams', async () => {
    stubMatches();

    render(<MatchSetupFlow />);

    await userEvent.click(await screen.findByRole('button', { name: /North Harbor FC/i }));

    expect(screen.getByRole('heading', { name: 'Which team do you support in this match?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /North Harbor FC/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eastgate City/i })).toBeInTheDocument();
  });

  it('allows selecting either team and exposes the selected state accessibly', async () => {
    stubMatches();

    render(<MatchSetupFlow />);

    await userEvent.click(await screen.findByRole('button', { name: /North Harbor FC/i }));

    const homeTeamButton = screen.getByRole('button', { name: /North Harbor FC/i });
    const awayTeamButton = screen.getByRole('button', { name: /Eastgate City/i });

    await userEvent.click(homeTeamButton);

    expect(homeTeamButton).toHaveAttribute('aria-pressed', 'true');
    expect(awayTeamButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Anthem selection is the next planned step/i)).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();

    await userEvent.click(awayTeamButton);

    expect(homeTeamButton).toHaveAttribute('aria-pressed', 'false');
    expect(awayTeamButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns to match selection and keeps the previously selected match highlighted', async () => {
    stubMatches();

    render(<MatchSetupFlow />);

    const matchButton = await screen.findByRole('button', { name: /North Harbor FC/i });

    await userEvent.click(matchButton);
    await userEvent.click(screen.getByRole('button', { name: 'Back to matches' }));

    const returnedMatchButton = await screen.findByRole('button', { name: /North Harbor FC/i });

    expect(screen.getByRole('heading', { name: 'Select a demo match' })).toBeInTheDocument();
    expect(returnedMatchButton).toHaveAttribute('aria-pressed', 'true');
    expect(returnedMatchButton).toHaveTextContent('Selected match');
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
