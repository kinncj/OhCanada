/**
 * Standalone PBR texture encoding: JPG/PNG → KTX2 (ktx create: ETC1S for colour/data, UASTC for normals)
 * or → WebP when KTX-Software is unavailable. Returns encoded bytes; callers decide whether to write.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** kind: 'color' (sRGB base colour) | 'data' (linear ARM/roughness) | 'normal' (linear, UASTC). */
export async function encodeTexture(src, { kind, size = 1024, format, tmpDir, alpha = false }) {
  let img = sharp(src).resize(size, size, { fit: 'inside', withoutEnlargement: true });
  img = alpha ? img.ensureAlpha() : img.removeAlpha();
  if (format === 'webp') return img.webp({ quality: kind === 'normal' ? 90 : 82 }).toBuffer();
  if (format === 'jpg') return img.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  mkdirSync(tmpDir, { recursive: true });
  const id = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const png = join(tmpDir, `${id}.png`);
  const out = join(tmpDir, `${id}.ktx2`);
  writeFileSync(png, await img.png().toBuffer());
  const channels = alpha ? 'R8G8B8A8' : 'R8G8B8';
  const args = ['create', '--generate-mipmap'];
  if (kind === 'normal') args.push('--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '2', '--zstd', '18', '--assign-tf', 'linear', '--assign-primaries', 'bt709', '--format', `${channels}_UNORM`);
  else if (kind === 'data') args.push('--encode', 'basis-lz', '--qlevel', '128', '--assign-tf', 'linear', '--assign-primaries', 'bt709', '--format', `${channels}_UNORM`);
  else args.push('--encode', 'basis-lz', '--qlevel', '128', '--assign-tf', 'srgb', '--assign-primaries', 'bt709', '--format', `${channels}_SRGB`);
  try {
    execFileSync('ktx', [...args, png, out], { stdio: ['ignore', 'ignore', 'pipe'] });
    return readFileSync(out);
  } finally {
    rmSync(png, { force: true });
    rmSync(out, { force: true });
  }
}

export const textureExt = (format) => (format === 'ktx2' ? 'ktx2' : format === 'webp' ? 'webp' : 'jpg');
