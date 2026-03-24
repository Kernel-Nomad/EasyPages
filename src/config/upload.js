import multer from 'multer';
import { ensureDirectory } from '../utils/files.js';
import { createHttpError } from '../core/errors/httpError.js';

export const MAX_UPLOAD_ARCHIVE_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
export const MAX_ZIP_ENTRY_COUNT = 2000;
export const MAX_UPLOAD_BATCH_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_ENTRY_COUNT = 50;

const hasZipExtension = (filename = '') => filename.toLowerCase().endsWith('.zip');

export const createUploadMiddleware = ({
  destination,
  maxFileSize = MAX_UPLOAD_ARCHIVE_BYTES,
} = {}) => {
  ensureDirectory(destination);

  return multer({
    dest: destination,
    limits: {
      fileSize: maxFileSize,
      files: 1,
    },
    fileFilter: (req, file, callback) => {
      if (hasZipExtension(file.originalname)) {
        callback(null, true);
        return;
      }

      callback(createHttpError(400, 'Solo se permiten archivos ZIP.'));
    },
  });
};
