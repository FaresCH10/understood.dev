import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface AudioProbe {
  durationS: number;
  mime: string;
}

export async function probeAudio(buffer: Buffer, extension: string): Promise<AudioProbe | null> {
  const dir = await mkdtemp(join(tmpdir(), 'understood-audio-'));
  const file = join(dir, `input.${extension}`);
  try {
    await writeFile(file, buffer);
    const { stdout } = await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return { durationS: Math.round(duration), mime: `audio/${extension === 'webm' ? 'webm' : extension}` };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function reencodePhoto(buffer: Buffer): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
