export const toCreateProjectInput = (req) => ({
  name: req.body.name,
});

export { toProjectInput } from '../shared.js';

export const toUpdateProjectBuildConfigInput = (req) => ({
  projectName: req.params.projectName,
  buildConfig: req.body.build_config,
});
