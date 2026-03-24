import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import AdmZip from 'adm-zip';
import { uploadProjectBundle } from '../../../../src/core/deployments/upload.js';

const writeZip = (dir, name, addFiles) => {
  const zipPath = path.join(dir, name);
  const zip = new AdmZip();
  for (const { path: entryPath, data } of addFiles) {
    zip.addFile(entryPath, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8'));
  }
  zip.writeZip(zipPath);
  return zipPath;
};

test('uploadProjectBundle procesa un ZIP válido y llama a Cloudflare', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ep-upload-'));
  try {
    const zipPath = writeZip(dir, 'ok.zip', [{ path: 'index.html', data: '<p>x</p>' }]);

    const calls = { uploadAssets: 0, post: 0 };
    const mockCloudflare = {
      get: async (resourcePath) => {
        assert.match(resourcePath, /upload-token$/);
        return { data: { result: { jwt: 'jwt-fixture' } } };
      },
      uploadAssets: async (batch) => {
        calls.uploadAssets += 1;
        assert.ok(Array.isArray(batch));
        assert.equal(batch.length, 1);
        assert.equal(batch[0].base64, true);
      },
      post: async (resourcePath, formData) => {
        calls.post += 1;
        assert.match(resourcePath, /\/deployments$/);
        assert.ok(formData && typeof formData.getHeaders === 'function');
      },
    };

    const result = await uploadProjectBundle({
      cloudflare: mockCloudflare,
      filePath: zipPath,
      projectName: 'demo',
      uploadLimits: {
        maxZipEntryBytes: 1024,
        maxTotalUncompressedBytes: 10_000,
        maxUploadBatchBytes: 1024 * 1024,
        maxUploadBatchEntryCount: 50,
      },
    });

    assert.deepEqual(result, { success: true, message: 'Despliegue realizado correctamente' });
    assert.equal(calls.uploadAssets, 1);
    assert.equal(calls.post, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadProjectBundle rechaza entrada cuyo contenido real supera maxZipEntryBytes', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ep-upload-'));
  try {
    const zipPath = writeZip(dir, 'big.zip', [{ path: 'a.txt', data: '12345' }]);

    const mockCloudflare = {
      get: async () => ({ data: { result: { jwt: 'j' } } }),
      uploadAssets: async () => {},
      post: async () => {},
    };

    await assert.rejects(
      () =>
        uploadProjectBundle({
          cloudflare: mockCloudflare,
          filePath: zipPath,
          projectName: 'demo',
          uploadLimits: {
            maxZipEntryBytes: 3,
            maxTotalUncompressedBytes: 1000,
            maxUploadBatchBytes: 1024,
            maxUploadBatchEntryCount: 50,
          },
        }),
      (err) => err.status === 413,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadProjectBundle rechaza ZIP cuyo total descomprimido real supera el límite', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ep-upload-'));
  try {
    const zipPath = writeZip(dir, 'total.zip', [
      { path: 'a.txt', data: 'aa' },
      { path: 'b.txt', data: 'bb' },
    ]);

    const mockCloudflare = {
      get: async () => ({ data: { result: { jwt: 'j' } } }),
      uploadAssets: async () => {},
      post: async () => {},
    };

    await assert.rejects(
      () =>
        uploadProjectBundle({
          cloudflare: mockCloudflare,
          filePath: zipPath,
          projectName: 'demo',
          uploadLimits: {
            maxZipEntryBytes: 100,
            maxTotalUncompressedBytes: 3,
            maxUploadBatchBytes: 1024,
            maxUploadBatchEntryCount: 50,
          },
        }),
      (err) => err.status === 413,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
