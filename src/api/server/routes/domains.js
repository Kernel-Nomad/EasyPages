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
        return res.status(400).json({ error: 'Nombre de proyecto inválido' });
      }

      const response = await cloudflare.get(`/pages/projects/${projectName}/domains`);
      res.json(response.data.result);
    } catch (error) {
      sendErrorResponse(res, error, 'Error domains');
    }
  });

  router.post('/projects/:projectName/domains', async (req, res) => {
    try {
      const { projectName } = req.params;
      const { name } = req.body;

      if (!isValidProjectName(projectName)) {
        return res.status(400).json({ error: 'Nombre de proyecto inválido' });
      }

      if (!isValidDomainName(name)) {
        return res.status(400).json({ error: 'Nombre de dominio inválido' });
      }

      const response = await cloudflare.post(`/pages/projects/${projectName}/domains`, { name });
      res.json(response.data.result);
    } catch (error) {
      sendErrorResponse(res, error, 'Error adding domain');
    }
  });

  router.delete('/projects/:projectName/domains/:domainName', async (req, res) => {
    try {
      const { projectName, domainName } = req.params;
      if (!isValidProjectName(projectName) || !isValidDomainName(domainName)) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
      }

      await cloudflare.delete(`/pages/projects/${projectName}/domains/${domainName}`);
      res.json({ success: true });
    } catch (error) {
      sendErrorResponse(res, error, 'Error deleting domain');
    }
  });

  return router;
};
