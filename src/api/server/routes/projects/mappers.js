export const toCreateProjectInput = (req) => ({
  name: req.body.name,
});

export const toProjectInput = (req) => ({
  projectName: req.params.projectName,
});

export const toUpdateProjectBuildConfigInput = (req) => ({
  projectName: req.params.projectName,
  buildConfig: req.body.build_config,
});
