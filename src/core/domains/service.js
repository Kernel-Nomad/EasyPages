export const createDomainsService = ({ cloudflare }) => ({
  async listDomains({ projectName }) {
    const response = await cloudflare.get(`/pages/projects/${projectName}/domains`);
    return response.data.result;
  },

  async addDomain({ name, projectName }) {
    const response = await cloudflare.post(`/pages/projects/${projectName}/domains`, { name });
    return response.data.result;
  },

  async deleteDomain({ domainName, projectName }) {
    await cloudflare.delete(`/pages/projects/${projectName}/domains/${domainName}`);
    return { success: true };
  },
});
