import express from 'express';
import { sendErrorResponse } from '../http.js';
import { isValidProjectName } from '../../../core/projects/validation.js';
import { isValidDomainName } from '../../../utils/validation.js';

export const createDomainsRouter = ({ cloudflare }) => {
  const router = express.Router();

  router.get('/projects/:projectName/domains', async (req, res) => {
    try {
      const { projectName } = req.params;
      if (!isValidProjectName(projectName)) {
        return res.status(400).json({ error: 'Invalid project name' });
      }

      const response = await cloudflare.get(`/pages/projects/${projectName}/domains`);
      res.json(response.data.result);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to load domains', req);
    }
  });

  router.post('/projects/:projectName/domains', async (req, res) => {
    try {
      const { projectName } = req.params;
      const { name } = req.body;

      if (!isValidProjectName(projectName)) {
        return res.status(400).json({ error: 'Invalid project name' });
      }

      if (!isValidDomainName(name)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }

      const response = await cloudflare.post(`/pages/projects/${projectName}/domains`, { name });
      res.json(response.data.result);
    } catch (error) {
      sendErrorResponse(res, error, 'Error adding the domain', req);
    }
  });

  router.delete('/projects/:projectName/domains/:domainName', async (req, res) => {
    try {
      const { projectName, domainName } = req.params;
      if (!isValidProjectName(projectName) || !isValidDomainName(domainName)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      await cloudflare.delete(`/pages/projects/${projectName}/domains/${domainName}`);
      res.json({ success: true });
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to delete the domain', req);
    }
  });

  return router;
};
