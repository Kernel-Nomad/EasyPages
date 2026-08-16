/**
 * Shared HTTP-route helpers used by both the projects and deployments routers.
 */

export const toProjectInput = (req) => ({
  projectName: req.params.projectName,
});
