import multer from 'multer';
import { AppError } from '../errors.js';

export const AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
]);

export const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export const CSV_MIME = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

export function uploader(allowed: Set<string>) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!allowed.has(file.mimetype)) {
        callback(new AppError('UNSUPPORTED_MEDIA'));
        return;
      }
      callback(null, true);
    },
  });
}
