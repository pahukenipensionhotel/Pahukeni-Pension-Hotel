import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'public/assets/images';
const MAX_WIDTH = 1920;
const QUALITY = 80;
const SIZE_THRESHOLD = 1 * 1024 * 1024; // 1MB

async function compressImage(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size < SIZE_THRESHOLD) return;

  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  console.log(`Compressing: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  const tmpPath = `${filePath}.tmp`;

  try {
    let pipeline = sharp(filePath).resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside'
    });

    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({ quality: QUALITY, progressive: true });
    } else if (ext === '.png') {
      pipeline = pipeline.png({ quality: QUALITY, compressionLevel: 9 });
    }

    await pipeline.toFile(tmpPath);

    // Replace original
    fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);

    const newStats = fs.statSync(filePath);
    console.log(`  Done: ${(newStats.size / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error(`  Error compressing ${filePath}:`, err);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

async function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      await walkDir(fullPath);
    } else {
      await compressImage(fullPath);
    }
  }
}

console.log('Starting image compression...');
walkDir(TARGET_DIR)
  .then(() => console.log('Compression complete!'))
  .catch(err => console.error('Compression failed:', err));
