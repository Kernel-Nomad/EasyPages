import crypto from 'crypto';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';
import FormData from 'form-data';
import {
  MAX_UPLOAD_BATCH_BYTES,
  MAX_UPLOAD_BATCH_ENTRY_COUNT,
  MAX_ZIP_ENTRY_BYTES,
  MAX_ZIP_ENTRY_COUNT,
  MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
} from '../../config/upload.js';
import { createHttpError } from '../errors/httpError.js';
import {
  getMimeType,
  normalizeZipEntryPath,
} from '../../utils/files.js';

const SAFE_VIRTUAL_ROOT = '/safe/root';
/** STORED (no compression) in the ZIP local file header. */
const ZIP_METHOD_STORED = 0;

const inflateRawAsync = promisify(zlib.inflateRaw);

const validationError = (message) =>
  createHttpError(400, message, { code: 'validation_error' });

const payloadTooLarge = (message) =>
  createHttpError(413, message, { code: 'payload_too_large' });

export const createUploadLimits = (uploadLimits = {}) => ({
  maxUploadBatchBytes: uploadLimits.maxUploadBatchBytes ?? MAX_UPLOAD_BATCH_BYTES,
  maxUploadBatchEntryCount:
    uploadLimits.maxUploadBatchEntryCount ?? MAX_UPLOAD_BATCH_ENTRY_COUNT,
  maxZipEntryBytes: uploadLimits.maxZipEntryBytes ?? MAX_ZIP_ENTRY_BYTES,
  maxZipEntryCount: uploadLimits.maxZipEntryCount ?? MAX_ZIP_ENTRY_COUNT,
  maxTotalUncompressedBytes:
    uploadLimits.maxTotalUncompressedBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
});

/**
 * Decompress with a hard output cap so a lying uncompressed-size header cannot allocate
 * unbounded memory before the post-check runs. Async so a large ZIP does not freeze the
 * event loop (and with it login/health).
 */
const readZipEntryContent = async (entry, maxBytes) => {
  let compressed;
  try {
    compressed = entry.getCompressedData();
  } catch {
    throw validationError('The ZIP archive is invalid or corrupt.');
  }

  if (!Buffer.isBuffer(compressed)) {
    throw validationError('The ZIP archive is invalid or corrupt.');
  }

  const method = entry.header?.method;
  if (method === ZIP_METHOD_STORED) {
    if (compressed.length > maxBytes) {
      throw payloadTooLarge('One of the files in the ZIP exceeds the allowed size.');
    }
    return compressed;
  }

  try {
    return await inflateRawAsync(compressed, { maxOutputLength: maxBytes });
  } catch (error) {
    if (
      error?.code === 'ERR_BUFFER_TOO_LARGE'
      || /exceed|too large|maxOutputLength/i.test(String(error?.message || ''))
    ) {
      throw payloadTooLarge('One of the files in the ZIP exceeds the allowed size.');
    }
    throw validationError('The ZIP archive is invalid or corrupt.');
  }
};

export const uploadProjectBundle = async ({
  cloudflare,
  filePath,
  projectName,
  uploadLimits = {},
}) => {
  const limits = createUploadLimits(uploadLimits);
  const encodedProject = encodeURIComponent(projectName);
  const tokenResponse = await cloudflare.get(
    `/pages/projects/${encodedProject}/upload-token`,
  );
  const jwt = tokenResponse.data.result.jwt;

  let zip;
  try {
    zip = new AdmZip(filePath);
  } catch {
    throw validationError('The uploaded file is not a valid ZIP archive.');
  }

  const zipEntries = zip.getEntries();

  if (zipEntries.length > limits.maxZipEntryCount) {
    throw payloadTooLarge('The ZIP archive contains too many files.');
  }

  const manifest = {};
  let totalUncompressedBytes = 0;
  let pendingUploadBatch = [];
  let pendingUploadBytes = 0;
  let uploadedFileCount = 0;

  const flushUploadBatch = async () => {
    if (pendingUploadBatch.length === 0) {
      return;
    }

    await cloudflare.uploadAssets(pendingUploadBatch, jwt);
    pendingUploadBatch = [];
    pendingUploadBytes = 0;
  };

  for (const entry of zipEntries) {
    if (entry.isDirectory) {
      continue;
    }

    const normalizedEntryPath = normalizeZipEntryPath(entry.entryName, SAFE_VIRTUAL_ROOT);
    if (!normalizedEntryPath) {
      throw validationError(
        'The ZIP archive contains an unsafe path and was rejected.',
      );
    }

    const declaredSize = entry.header.size || 0;
    if (declaredSize > limits.maxZipEntryBytes) {
      throw payloadTooLarge('One of the files in the ZIP exceeds the allowed size.');
    }

    const content = await readZipEntryContent(entry, limits.maxZipEntryBytes);
    const actualSize = content.length;
    if (actualSize > limits.maxZipEntryBytes) {
      throw payloadTooLarge('One of the files in the ZIP exceeds the allowed size.');
    }

    totalUncompressedBytes += actualSize;
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
      throw payloadTooLarge(
        'The uncompressed contents of the ZIP exceed the allowed size.',
      );
    }

    if (
      pendingUploadBatch.length > 0
      && (
        pendingUploadBatch.length >= limits.maxUploadBatchEntryCount
        || pendingUploadBytes + actualSize > limits.maxUploadBatchBytes
      )
    ) {
      await flushUploadBatch();
    }

    const hash = crypto.createHash('md5').update(content).digest('hex');

    pendingUploadBatch.push({
      key: hash,
      value: content.toString('base64'),
      metadata: { contentType: getMimeType(normalizedEntryPath) },
      base64: true,
    });
    pendingUploadBytes += actualSize;
    uploadedFileCount += 1;
    manifest[normalizedEntryPath] = hash;
  }

  if (uploadedFileCount === 0) {
    throw validationError('The ZIP file is empty or contains no valid, safe files.');
  }

  await flushUploadBatch();

  const formData = new FormData();
  formData.append('manifest', JSON.stringify(manifest));

  await cloudflare.post(`/pages/projects/${encodedProject}/deployments`, formData, {
    headers: formData.getHeaders(),
  });

  return { success: true, message: 'Deployment completed successfully' };
};
