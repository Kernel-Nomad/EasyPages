export const toDeleteDeploymentsInput = (req) => ({
  deploymentIds: req.body.deploymentIds.map((id) => id.trim()),
  projectName: req.params.projectName,
});

export const toDeleteDeploymentsResponse = (result) => ({
  message: 'Batch processed',
  ...result,
});

export const toListDeploymentsInput = (req) => {
  const rawPage = Number.parseInt(req.query?.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return {
    page,
    projectName: req.params.projectName,
  };
};

export { toProjectInput } from '../shared.js';

export const toUploadProjectBundleInput = (req) => ({
  filePath: req.file.path,
  projectName: req.params.projectName,
});
