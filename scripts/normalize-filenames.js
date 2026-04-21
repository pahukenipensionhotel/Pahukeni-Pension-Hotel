import fs from 'fs';
import path from 'path';

const TARGET_DIRS = [
  'public/assets/images/rooms/single_room',
  'public/assets/images/rooms/double_room',
  'public/assets/images/dining',
  'public/assets/images/bar'
];

function normalizeName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const oldPath = path.join(dir, file);
    if (fs.statSync(oldPath).isDirectory()) return;

    const newName = normalizeName(file);
    const newPath = path.join(dir, newName);

    if (oldPath !== newPath) {
      console.log(`Renaming: ${oldPath} -> ${newPath}`);
      fs.renameSync(oldPath, newPath);
    }
  });
}

TARGET_DIRS.forEach(processDir);
console.log('Filenames normalized!');
