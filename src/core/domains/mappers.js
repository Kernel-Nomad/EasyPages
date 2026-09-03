/**
 * DTO for Cloudflare Pages domains. The SPA only needs id, name and status;
 * verification payloads and other upstream fields stay on Cloudflare.
 *
 * @param {unknown} domain
 * @returns {{ id?: string, name?: string, status?: string }}
 */
export const mapCloudflareDomain = (domain) => {
  const raw = domain && typeof domain === 'object' && !Array.isArray(domain) ? domain : {};
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  };
};
