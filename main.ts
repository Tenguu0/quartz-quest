// main.ts — entrypoint "Quartz Quest" untuk bounty best-game-01.
//
// Tugas file ini cuma satu: merakit dossier yang akan dinilai juri.
// Caranya: salin game + screenshot ke direktori output, lalu minta
// buildDossier (dari kit vendor) mengemas semuanya jadi dossier.json.
// Tidak ada dependensi luar — stdlib Node saja.

import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// Batas ukuran dossier, sesuai gate bounty best-game-01.
const DOSSIER_CAPS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
};

// Salin satu folder bila ada; diam-diam lewati bila tidak ada.
// Mengembalikan true kalau benar-benar menyalin sesuatu.
async function copyFolderIfExists(from: string, to: string): Promise<boolean> {
  if (!existsSync(from)) return false;
  await cp(from, to, { recursive: true });
  return true;
}

async function main(): Promise<void> {
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  await mkdir(outDir, { recursive: true });

  // Game statis (index.html + modul ES di src/) masuk ke <output>/game.
  await cp(resolve('game'), join(outDir, 'game'), { recursive: true });

  // Fail fast kalau entrypoint game tidak ikut tersalin — dossier tanpa
  // game yang bisa dimainkan tidak ada gunanya buat juri.
  await stat(join(outDir, 'game', 'index.html'));

  // Screenshot opsional — cuma disalin kalau foldernya memang ada.
  const shotsCopied = await copyFolderIfExists(
    resolve('screenshots'),
    join(outDir, 'screenshots'),
  );

  // Kemas dossier dari isi direktori output yang baru dirakit.
  const packed = buildDossier(outDir, DOSSIER_CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  await writeFile(dossierPath, packed);

  // Pastikan hasil tulisannya benar-benar ada isinya sebelum melapor sukses.
  const written = await stat(dossierPath);
  if (written.size === 0) throw new Error('dossier.json came out empty');

  console.log(`dossier written: ${dossierPath} (${packed.length} bytes)`);
  console.log(`screenshots copied: ${shotsCopied ? 'yes' : 'no (folder missing)'}`);
}

main().catch((err: unknown) => {
  console.error('main.ts failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
