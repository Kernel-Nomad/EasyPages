import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidProjectName,
  validateBuildConfig,
  validateEnvPayload,
} from '../../../../src/core/projects/validation.js';

test('isValidProjectName', () => {
  assert.equal(isValidProjectName('my-app'), true);
  assert.equal(isValidProjectName('Bad_Name'), false);
  assert.equal(isValidProjectName(''), false);
});

test('validateBuildConfig', () => {
  assert.equal(validateBuildConfig(null), 'La configuración de build es inválida.');
  assert.equal(validateBuildConfig({}), 'Debe indicar al menos un valor de build_config.');
  assert.equal(validateBuildConfig({ command: 'npm run build' }), null);
});

test('validateEnvPayload', () => {
  assert.equal(validateEnvPayload({ FOO: 'bar' }), null);
  assert.equal(validateEnvPayload({ '': 'x' }), 'Las claves de entorno deben ser textos no vacíos.');
});
