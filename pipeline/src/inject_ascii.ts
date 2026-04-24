import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { convertToAscii } from './ascii.js';
import type { BookManifest } from '../../reader/src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_PATH = '/home/stephen/.gemini/antigravity/brain/63e06ce6-a264-4ce0-ace0-3801dfa619fe/march_hare_ascii_source_1777030143855.png';
const MANIFEST_PATH = join(__dirname, '../../reader/public/books/alice.manifest.json');

async function run() {
  console.log('🎨 Converting March Hare to ASCII...');
  const asset = await convertToAscii(IMAGE_PATH, 80); // 80 cells wide for detail
  
  console.log('📖 Loading Alice manifest...');
  const manifest: BookManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  
  // Inject into the first scene of Chapter 1
  if (manifest.chapters[0] && manifest.chapters[0].scenes[0]) {
    manifest.chapters[0].scenes[0].illustration = asset;
    console.log('✅ Injected into Chapter 1, Scene 1.');
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('🚀 Done!');
}

run().catch(console.error);
