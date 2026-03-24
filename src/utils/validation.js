const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const isValidDomainName = (name) => {
  if (typeof name !== 'string') {
    return false;
  }

  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName || normalizedName.length > 253) {
    return false;
  }

  if (normalizedName.startsWith('.') || normalizedName.endsWith('.') || normalizedName.includes('..')) {
    return false;
  }

  const labels = normalizedName.split('.');
  if (labels.length < 2) {
    return false;
  }

  return labels.every((label) => DOMAIN_LABEL_REGEX.test(label));
};
