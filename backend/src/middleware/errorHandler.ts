import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AuthError } from '../modules/auth/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AuthError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is too large (max 25 MB).'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'You can attach at most 5 files.'
          : 'Upload failed. Try a smaller file.';
    res.status(400).json({
      error: { code: err.code, message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
