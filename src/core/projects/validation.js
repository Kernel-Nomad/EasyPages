const PROJECT_NAME_REGEX = /^[a-z0-9-]+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isValidProjectName = (name) =>
  Boolean(name) && PROJECT_NAME_REGEX.test(name);

export const validateBuildConfig = (buildConfig) => {
  if (!isPlainObject(buildConfig)) {
    return 'The build configuration is invalid.';
  }

  const hasCommand = buildConfig.command !== undefined;
  const hasOutputDir = buildConfig.output_dir !== undefined;

  if (!hasCommand && !hasOutputDir) {
    return 'Debe indicar al menos un valor de build_config.';
  }

  if (hasCommand && typeof buildConfig.command !== 'string') {
    return 'El comando de build debe ser un texto.';
  }

  if (hasOutputDir && typeof buildConfig.output_dir !== 'string') {
    return 'El directorio de salida debe ser un texto.';
  }

  return null;
};

export const validateEnvPayload = (env) => {
  if (!isPlainObject(env)) {
    return 'The environment variable configuration is invalid.';
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof key !== 'string' || key.trim() === '') {
      return 'Environment keys must be non-empty strings.';
    }

    if (typeof value !== 'string') {
      return 'Los valores de entorno deben ser textos.';
    }
  }

  return null;
};
