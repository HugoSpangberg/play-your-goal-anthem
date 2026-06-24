type CountryFlagProps = {
  countryCode?: string | null;
  decorative?: boolean;
  label?: string;
  size?: 'small' | 'large';
};

export function CountryFlag({ countryCode, decorative = false, label, size = 'small' }: CountryFlagProps) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const flag = normalizedCode ? codeToFlagEmoji(normalizedCode) : null;
  const accessibleLabel = label ?? (normalizedCode ? `Flag of ${normalizedCode}` : 'Country unavailable');

  return (
    <span
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : accessibleLabel}
      className="country-flag"
      data-size={size}
      role={decorative ? undefined : 'img'}
    >
      {flag ?? <span aria-hidden="true">•</span>}
    </span>
  );
}

function normalizeCountryCode(countryCode?: string | null) {
  if (!countryCode) {
    return null;
  }

  const normalized = countryCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function codeToFlagEmoji(countryCode: string) {
  const base = 127397;
  return String.fromCodePoint(...[...countryCode].map((character) => base + character.charCodeAt(0)));
}
