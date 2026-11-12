import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { ValidationException } from '@johnanthonyeletto/nestjs-inertia'

const UPLOAD_DIRECTORY = 'storage/uploads'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

/** Validate and store an uploaded avatar, returning its path relative to the upload directory. */
export async function storeAvatar(file: Express.Multer.File): Promise<string> {
  const extension = IMAGE_TYPES[file.mimetype]

  if (!extension) {
    throw ValidationException.withMessages({ avatar: 'The avatar must be a JPG, PNG, GIF, or WebP image.' })
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw ValidationException.withMessages({ avatar: 'The avatar must not be greater than 2 MB.' })
  }

  const path = join('avatars', `${randomUUID()}${extension}`)

  await mkdir(join(UPLOAD_DIRECTORY, 'avatars'), { recursive: true })
  await writeFile(join(UPLOAD_DIRECTORY, path), file.buffer)

  return path
}

export async function deleteAvatar(path: string | null): Promise<void> {
  if (path && extname(path)) {
    await unlink(join(UPLOAD_DIRECTORY, path)).catch(() => undefined)
  }
}
