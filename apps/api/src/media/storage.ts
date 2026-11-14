import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttlSeconds?: number): Promise<{ url: string; expiresAt: Date }>;
  deletePrefix(prefix: string): Promise<void>;
}

class LocalStorage implements Storage {
  private root = resolve(process.cwd(), config.MEDIA_LOCAL_DIR);

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<Buffer> {
    const { readFile } = await import('node:fs/promises');
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async signedUrl(key: string, ttlSeconds = config.MEDIA_URL_TTL_SECONDS): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { url: `${config.APP_URL}/media/${key}?exp=${Math.floor(expiresAt.getTime() / 1000)}`, expiresAt };
  }

  async deletePrefix(prefix: string): Promise<void> {
    const target = this.pathFor(prefix);
    await rm(target, { recursive: true, force: true });
  }

  private pathFor(key: string): string {
    const target = resolve(join(this.root, key));
    if (!target.startsWith(this.root)) throw new Error('invalid storage key');
    return target;
  }
}

class R2Storage implements Storage {
  private client = new S3Client({
    region: config.R2_REGION,
    endpoint: config.R2_ENDPOINT,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID!,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY!,
    },
  });

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: config.R2_BUCKET!, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: config.R2_BUCKET!, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error('empty object');
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await this.client.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET!, Key: key }));
  }

  async signedUrl(key: string, ttlSeconds = config.MEDIA_URL_TTL_SECONDS): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const command = new GetObjectCommand({ Bucket: config.R2_BUCKET!, Key: key });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: ttlSeconds,
      signableHeaders: new Set(['host']),
    });
    return { url, expiresAt };
  }

  async deletePrefix(prefix: string): Promise<void> {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    let token: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({ Bucket: config.R2_BUCKET!, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (listed.Contents ?? []).flatMap((item) => (item.Key ? [{ Key: item.Key }] : []));
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: config.R2_BUCKET!, Delete: { Objects: keys } }),
        );
      }
      token = listed.NextContinuationToken;
    } while (token);
  }
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  if (!storage) storage = config.MEDIA_DRIVER === 'r2' ? new R2Storage() : new LocalStorage();
  return storage;
}

export function mediaKeyForVoice(orgId: string, instructionId: string, ext: string): string {
  return `orgs/${orgId}/instructions/${instructionId}/voice-${Date.now().toString(36)}.${ext}`;
}

export function mediaKeyForPhoto(orgId: string, instructionId: string): string {
  return `orgs/${orgId}/instructions/${instructionId}/photo-${Date.now().toString(36)}.jpg`;
}
