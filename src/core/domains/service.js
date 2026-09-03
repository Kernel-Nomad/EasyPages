import { listAllPages } from '../cloudflare/client.js';
import { mapCloudflareDomain } from './mappers.js';

export const createDomainsService = ({ cloudflare }) => ({
  async listDomains({ projectName }) {
    const encoded = encodeURIComponent(projectName);
    const domains = await listAllPages(cloudflare, `/pages/projects/${encoded}/domains`);
    return domains.map(mapCloudflareDomain);
  },

  async addDomain({ name, projectName }) {
    const response = await cloudflare.post(
      `/pages/projects/${encodeURIComponent(projectName)}/domains`,
      { name },
    );
    return mapCloudflareDomain(response.data.result);
  },

  async deleteDomain({ domainName, projectName }) {
    await cloudflare.delete(
      `/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domainName)}`,
    );
    return { success: true };
  },
});
