import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountryFlag } from './CountryFlag';

describe('CountryFlag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a bundled local flag asset for known countries without Unicode emoji', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<CountryFlag countryCode="se" countryName="Sweden" />);

    const image = screen.getByAltText('Flag of Sweden');
    const flag = image.closest('.country-flag');

    expect(flag).not.toBeNull();
    expect(flag).toHaveClass('country-flag', 'country-flag--small');
    expect(flag).toHaveAttribute('data-has-flag', 'true');
    expect(image.getAttribute('src')).toBeTruthy();
    expect(image.getAttribute('src')).toContain('image/svg+xml');
    expect(image.getAttribute('src')).not.toMatch(/^https?:\/\//);
    expect(flag).not.toHaveTextContent('🇸🇪');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders decorative local artwork beside visible country text', () => {
    render(<CountryFlag countryCode="jp" countryName="Japan" decorative size="large" />);

    expect(screen.queryByRole('img', { name: /flag of/i })).not.toBeInTheDocument();
    const wrapper = screen.getByTestId('country-flag-JP');
    const image = wrapper.querySelector('img');
    expect(wrapper).toHaveClass('country-flag--large');
    expect(image).toHaveAttribute('alt', '');
    expect(wrapper).not.toHaveTextContent('🇯🇵');
  });

  it('does not fall back for known World Cup countries with resolved ISO codes', () => {
    render(<CountryFlag countryCode="qa" countryName="Qatar" />);

    const flag = screen.getByAltText('Flag of Qatar').closest('.country-flag');
    expect(flag).not.toBeNull();
    if (!flag) {
      throw new Error('Expected Qatar flag wrapper.');
    }
    expect(flag).toHaveAttribute('data-has-flag', 'true');
    expect(flag.querySelector('.country-flag__fallback')).not.toBeInTheDocument();
  });

  it('uses a neutral fallback only when no usable local flag exists', () => {
    render(<CountryFlag countryCode="zz" countryName="Unknown Team" />);

    const flag = screen.getByRole('img', { name: 'Flag of Unknown Team' });
    expect(flag).toHaveAttribute('data-has-flag', 'false');
    expect(flag.querySelector('img')).not.toBeInTheDocument();
    expect(flag).toHaveTextContent('UT');
  });
});
