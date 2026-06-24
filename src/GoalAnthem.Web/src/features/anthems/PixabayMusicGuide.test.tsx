import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PixabayMusicGuide } from './PixabayMusicGuide';

describe('PixabayMusicGuide', () => {
  it('renders the manual discovery workflow with safe official links', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<PixabayMusicGuide />);

    expect(screen.getByRole('heading', { name: 'Need an anthem?' })).toBeInTheDocument();
    expect(screen.getByText('Browse Pixabay Music', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('Download a track')).toBeInTheDocument();
    expect(screen.getByText('Return and upload it above')).toBeInTheDocument();
    expect(screen.getByText('Source details and Content ID note')).toBeInTheDocument();

    const musicLink = screen.getByRole('link', { name: /Browse Pixabay Music/i });
    expect(musicLink).toHaveAttribute('href', 'https://pixabay.com/music/');
    expect(musicLink).toHaveAttribute('target', '_blank');
    expect(musicLink).toHaveAttribute('rel', 'noreferrer noopener');

    const licenseLink = screen.getByRole('link', { name: /Read license summary/i });
    expect(licenseLink).toHaveAttribute('href', 'https://pixabay.com/service/license-summary/');
    expect(licenseLink).toHaveAttribute('target', '_blank');
    expect(licenseLink).toHaveAttribute('rel', 'noreferrer noopener');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
