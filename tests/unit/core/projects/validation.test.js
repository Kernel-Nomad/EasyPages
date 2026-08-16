import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidProjectName,
  validateBuildConfig,
} from '../../../../src/core/projects/validation.js';

test('isValidProjectName', () => {
  assert.equal(isValidProjectName('my-app'), true);
  assert.equal(isValidProjectName('a'), true);
  assert.equal(isValidProjectName('Bad_Name'), false);
  assert.equal(isValidProjectName('-foo'), false);
  assert.equal(isValidProjectName('foo-'), false);
  assert.equal(isValidProjectName('---'), false);
  assert.equal(isValidProjectName(''), false);
  assert.equal(isValidProjectName('a'.repeat(59)), false);
});

test('validateBuildConfig', () => {
  assert.equal(validateBuildConfig(null), 'The build configuration is invalid.');
  assert.equal(validateBuildConfig({}), 'Provide at least one build_config value.');
  assert.equal(validateBuildConfig({ command: 'npm run build' }), null);
});
