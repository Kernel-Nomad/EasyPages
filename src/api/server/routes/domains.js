import express from 'express';
import { createDomainsService } from '../../../core/domains/service.js';
import {
  isValidDomainName,
  normalizeDomainName,
} from '../../../core/domains/validation.js';
import { isValidProjectName } from '../../../core/projects/validation.js';
import { sendErrorResponse, sendValidationError } from '../http.js';

export const createDomainsRouter = ({ cloudflare }) => {
  const router = express.Router();
  const domainsService = createDomainsService({ cloudflare });

  router.get('/projects/:projectName/domains', async (req, res) => {
    try {
      const { projectName } = req.params;
      if (!isValidProjectName(projectName)) {
        return sendValidationError(res, 'Invalid project name');
      }

      const domains = await domainsService.listDomains({ projectName });
      res.json(domains);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to load domains', req);
    }
  });

  router.post('/projects/:projectName/domains', async (req, res) => {
    try {
      const { projectName } = req.params;
      const normalizedName = normalizeDomainName(req.body?.name);

      if (!isValidProjectName(projectName)) {
        return sendValidationError(res, 'Invalid project name');
      }

      if (!isValidDomainName(normalizedName)) {
        return sendValidationError(res, 'Invalid domain name', 'invalid_domain');
      }

      const domain = await domainsService.addDomain({
        name: normalizedName,
        projectName,
      });
      res.json(domain);
    } catch (error) {
      sendErrorResponse(res, error, 'Error adding the domain', req);
    }
  });

  router.delete('/projects/:projectName/domains/:domainName', async (req, res) => {
    try {
      const { projectName, domainName } = req.params;
      const normalizedDomain = normalizeDomainName(domainName);
      if (!isValidProjectName(projectName) || !isValidDomainName(normalizedDomain)) {
        return sendValidationError(res, 'Invalid parameters');
      }

      const result = await domainsService.deleteDomain({
        domainName: normalizedDomain,
        projectName,
      });
      res.json(result);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to delete the domain', req);
    }
  });

  return router;
};
