import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PixabayMusicGuide } from './PixabayMusicGuide';

describe('PixabayMusicGuide', () => {
  it('renders the manual discovery workflow with safe official links', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<PixabayMusicGuide />);

    expect(screen.getByRole('heading', { name: 'Find royalty-free music' })).toBeInTheDocument();
    expect(screen.getByText(/does not connect to Pixabay, download tracks, or verify licenses/i)).toBeInTheDocument();
    expect(screen.getByText(/Imported files stay in this browser and are never uploaded/i)).toBeInTheDocument();

    const musicLink = screen.getByRole('link', { name: /Browse Pixabay Music/i });
    expect(musicLink).toHaveAttribute('href', 'https://pixabay.com/music/');
    expect(musicLink).toHaveAttribute('target', '_blank');
    expect(musicLink).toHaveAttribute('rel', 'noreferrer noopener');

    const licenseLink = screen.getByRole('link', { name: /Read Pixabay Content License/i });
    expect(licenseLink).toHaveAttribute('href', 'https://pixabay.com/service/license-summary/');
    expect(licenseLink).toHaveAttribute('target', '_blank');
    expect(licenseLink).toHaveAttribute('rel', 'noreferrer noopener');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
