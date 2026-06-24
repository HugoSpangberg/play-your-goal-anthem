import { flagAssets } from './flagAssets';

type CountryFlagProps = {
  countryCode?: string | null;
  countryName: string;
  decorative?: boolean;
  size?: 'small' | 'medium' | 'large';
};

export function CountryFlag({ countryCode, countryName, decorative = false, size = 'small' }: CountryFlagProps) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const flagAsset = normalizedCode ? flagAssets[normalizedCode as keyof typeof flagAssets] : undefined;
  const accessibleLabel = `Flag of ${countryName}`;
  const fallbackLabel = getFallbackAbbreviation(countryName);
  const hasFlag = Boolean(flagAsset);

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      className={`country-flag country-flag--${size}`}
      data-has-flag={hasFlag}
      data-testid={`country-flag-${normalizedCode ?? fallbackLabel.toLowerCase()}`}
      role={!decorative && !flagAsset ? 'img' : undefined}
      aria-label={!decorative && !flagAsset ? accessibleLabel : undefined}
    >
      {flagAsset ? (
        <img alt={decorative ? '' : accessibleLabel} className="country-flag__image" src={flagAsset} />
      ) : (
        <span aria-hidden={decorative ? true : undefined} className="country-flag__fallback">
          {fallbackLabel}
        </span>
      )}
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

function getFallbackAbbreviation(countryName: string) {
  const words = countryName
    .split(/[\s-]+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return countryName.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '??';
}
