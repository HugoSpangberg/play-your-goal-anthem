import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountryFlag } from './CountryFlag';

describe('CountryFlag', () => {
  it('renders an accessible Unicode flag without external images', () => {
    render(<CountryFlag countryCode="se" label="Flag of Sweden" />);

    expect(screen.getByRole('img', { name: 'Flag of Sweden' })).toHaveTextContent('🇸🇪');
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders a neutral fallback when the country code is missing', () => {
    render(<CountryFlag />);

    expect(screen.getByRole('img', { name: 'Country unavailable' })).toHaveTextContent('•');
  });

  it('can render as decorative beside visible team text', () => {
    render(<CountryFlag countryCode="jp" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🇯🇵')).toBeInTheDocument();
  });
});
