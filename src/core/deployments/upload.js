import crypto from 'crypto';
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
  isSafeZipEntry,
  normalizeZipEntryPath,
} from '../../utils/files.js';

const SAFE_VIRTUAL_ROOT = '/safe/root';

export const createUploadLimits = (uploadLimits = {}) => ({
  maxUploadBatchBytes: uploadLimits.maxUploadBatchBytes ?? MAX_UPLOAD_BATCH_BYTES,
  maxUploadBatchEntryCount:
    uploadLimits.maxUploadBatchEntryCount ?? MAX_UPLOAD_BATCH_ENTRY_COUNT,
  maxZipEntryBytes: uploadLimits.maxZipEntryBytes ?? MAX_ZIP_ENTRY_BYTES,
  maxZipEntryCount: uploadLimits.maxZipEntryCount ?? MAX_ZIP_ENTRY_COUNT,
  maxTotalUncompressedBytes:
    uploadLimits.maxTotalUncompressedBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
});

export const uploadProjectBundle = async ({
  cloudflare,
  filePath,
  projectName,
  uploadLimits = {},
}) => {
  const limits = createUploadLimits(uploadLimits);
  const tokenResponse = await cloudflare.get(`/pages/projects/${projectName}/upload-token`);
  const jwt = tokenResponse.data.result.jwt;
  const zip = new AdmZip(filePath);
  const zipEntries = zip.getEntries();

  if (zipEntries.length > limits.maxZipEntryCount) {
    throw createHttpError(413, 'El archivo ZIP contiene demasiados archivos.');
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

    if (!isSafeZipEntry(entry.entryName, SAFE_VIRTUAL_ROOT)) {
      console.warn(`⚠️ Ignorando archivo malicioso (Zip Slip): ${entry.entryName}`);
      continue;
    }

    const normalizedEntryPath = normalizeZipEntryPath(entry.entryName, SAFE_VIRTUAL_ROOT);
    if (!normalizedEntryPath) {
      continue;
    }

    const entrySize = entry.header.size || 0;
    if (entrySize > limits.maxZipEntryBytes) {
      throw createHttpError(413, 'Uno de los archivos del ZIP excede el tamaño permitido.');
    }

    totalUncompressedBytes += entrySize;
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
      throw createHttpError(
        413,
        'El contenido descomprimido del ZIP excede el tamaño permitido.',
      );
    }

    if (
      pendingUploadBatch.length > 0
      && (
        pendingUploadBatch.length >= limits.maxUploadBatchEntryCount
        || pendingUploadBytes + entrySize > limits.maxUploadBatchBytes
      )
    ) {
      await flushUploadBatch();
    }

    const content = entry.getData();
    const hash = crypto.createHash('md5').update(content).digest('hex');

    pendingUploadBatch.push({
      key: hash,
      value: content.toString('base64'),
      metadata: { contentType: getMimeType(normalizedEntryPath) },
      base64: true,
    });
    pendingUploadBytes += entrySize;
    uploadedFileCount += 1;
    manifest[normalizedEntryPath] = hash;
  }

  if (uploadedFileCount === 0) {
    throw createHttpError(400, 'El archivo ZIP está vacío, no contiene archivos válidos o seguros.');
  }

  await flushUploadBatch();

  const formData = new FormData();
  formData.append('manifest', JSON.stringify(manifest));

  await cloudflare.post(`/pages/projects/${projectName}/deployments`, formData, {
    headers: formData.getHeaders(),
  });

  return { success: true, message: 'Despliegue realizado correctamente' };
};
