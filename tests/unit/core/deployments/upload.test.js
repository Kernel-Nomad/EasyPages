import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import zlib from 'node:zlib';
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

/** AdmZip normalises `../` on addFile; craft the local header by hand for zip-slip tests. */
const writeRawZip = (dir, name, entries) => {
  const zipPath = path.join(dir, name);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { path: entryPath, data } of entries) {
    const nameBuf = Buffer.from(entryPath, 'utf8');
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const crc = zlib.crc32(dataBuf);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localFull = Buffer.concat([local, nameBuf, dataBuf]);
    locals.push(localFull);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(dataBuf.length, 20);
    cen.writeUInt32LE(dataBuf.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([cen, nameBuf]));
    offset += localFull.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(zipPath, Buffer.concat([...locals, centralDir, end]));
  return zipPath;
};

test('uploadProjectBundle processes a valid ZIP and calls Cloudflare', async () => {
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

    assert.deepEqual(result, { success: true, message: 'Deployment completed successfully' });
    assert.equal(calls.uploadAssets, 1);
    assert.equal(calls.post, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadProjectBundle rejects an entry whose real content exceeds maxZipEntryBytes', async () => {
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

test('uploadProjectBundle rejects a ZIP whose real uncompressed total exceeds the limit', async () => {
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

test('uploadProjectBundle rejects a ZIP that mixes safe files with zip-slip paths', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ep-upload-'));
  try {
    const zipPath = writeRawZip(dir, 'slip.zip', [
      { path: 'index.html', data: '<p>ok</p>' },
      { path: '../evil.txt', data: 'nope' },
    ]);

    const mockCloudflare = {
      get: async () => ({ data: { result: { jwt: 'j' } } }),
      uploadAssets: async () => {
        assert.fail('must not upload any assets from a tainted ZIP');
      },
      post: async () => {
        assert.fail('must not create a deployment from a tainted ZIP');
      },
    };

    await assert.rejects(
      () =>
        uploadProjectBundle({
          cloudflare: mockCloudflare,
          filePath: zipPath,
          projectName: 'demo',
          uploadLimits: {
            maxZipEntryBytes: 1024,
            maxTotalUncompressedBytes: 10_000,
            maxUploadBatchBytes: 1024,
            maxUploadBatchEntryCount: 50,
          },
        }),
      (err) => err.status === 400 && /unsafe path/i.test(err.message),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadProjectBundle rejects inflated entries that exceed the size cap', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ep-upload-'));
  try {
    const zeros = Buffer.alloc(64 * 1024, 0);
    const compressed = zlib.deflateRawSync(zeros);
    const nameBuf = Buffer.from('bomb.bin', 'utf8');
    const crc = zlib.crc32(zeros);

    // Local header with a lying small uncompressed size (classic zip-bomb signal).
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(16, 22); // lie: claim only 16 uncompressed bytes
    local.writeUInt16LE(nameBuf.length, 26);
    const localFull = Buffer.concat([local, nameBuf, compressed]);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(compressed.length, 20);
    cen.writeUInt32LE(16, 24);
    cen.writeUInt16LE(nameBuf.length, 28);

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(cen.length + nameBuf.length, 12);
    end.writeUInt32LE(localFull.length, 16);

    const zipPath = path.join(dir, 'bomb.zip');
    writeFileSync(zipPath, Buffer.concat([localFull, cen, nameBuf, end]));

    const mockCloudflare = {
      get: async () => ({ data: { result: { jwt: 'j' } } }),
      uploadAssets: async () => {
        assert.fail('must not upload a zip bomb');
      },
      post: async () => {
        assert.fail('must not deploy a zip bomb');
      },
    };

    await assert.rejects(
      () =>
        uploadProjectBundle({
          cloudflare: mockCloudflare,
          filePath: zipPath,
          projectName: 'demo',
          uploadLimits: {
            maxZipEntryBytes: 1024,
            maxTotalUncompressedBytes: 10_000,
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
