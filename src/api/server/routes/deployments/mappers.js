export const toDeleteDeploymentsInput = (req) => ({
  deploymentIds: req.body.deploymentIds,
  projectName: req.params.projectName,
});

export const toDeleteDeploymentsResponse = (result) => ({
  message: 'Lote procesado',
  ...result,
});

export const toProjectInput = (req) => ({
  projectName: req.params.projectName,
});

export const toUploadProjectBundleInput = (req) => ({
  filePath: req.file.path,
  projectName: req.params.projectName,
});
