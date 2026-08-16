import { listAllPages } from '../cloudflare/client.js';

export const createDomainsService = ({ cloudflare }) => ({
  async listDomains({ projectName }) {
    const encoded = encodeURIComponent(projectName);
    return listAllPages(cloudflare, `/pages/projects/${encoded}/domains`);
  },

  async addDomain({ name, projectName }) {
    const response = await cloudflare.post(
      `/pages/projects/${encodeURIComponent(projectName)}/domains`,
      { name },
    );
    return response.data.result;
  },

  async deleteDomain({ domainName, projectName }) {
    await cloudflare.delete(
      `/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domainName)}`,
    );
    return { success: true };
  },
});
