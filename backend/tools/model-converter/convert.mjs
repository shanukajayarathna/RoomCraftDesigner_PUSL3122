import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import assimpjsPkg from 'assimpjs';
import { unzipSync } from 'fflate';

/**
 * Usage:
 *   node convert.mjs <inputPath> <outputGlbPath>
 *
 * Notes:
 * - Assimp supports many formats, but texture embedding depends on source format.
 * - This converter produces a GLB; when source references external textures, it will try
 *   to include them if they are packaged alongside the source (e.g. ZIP extracted dir).
 */
async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error('Usage: node convert.mjs <inputPath> <outputGlbPath>');
    process.exit(2);
  }

  const stat = await fs.stat(inputPath).catch(() => null);
  if (!stat || !stat.isFile()) {
    console.error('Input file not found:', inputPath);
    process.exit(2);
  }

  const assimpjs = await assimpjsPkg();
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');
  const base = path.basename(inputPath);

  const createPathFor = (p) => {
    const parts = p.split('/').filter(Boolean);
    let cur = '/';
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      try { assimpjs.FS_createPath(cur, dir, true, true); } catch {}
      cur = cur.endsWith('/') ? cur + dir : cur + '/' + dir;
    }
  };

  const isModel = (f) => {
    const e = path.extname(f).toLowerCase().replace('.', '');
    return ['glb','gltf','fbx','obj','dae','stl','ply','3ds','blend'].includes(e);
  };

  let inputName = base;

  // If a ZIP is uploaded, extract all files into assimp virtual FS so textures resolve.
  if (ext === 'zip') {
    const zipBytes = await fs.readFile(inputPath);
    const files = unzipSync(new Uint8Array(zipBytes));

    // Write all entries
    const names = Object.keys(files).filter(n => !n.endsWith('/'));
    for (const name of names) {
      const clean = name.replace(/\\/g, '/').replace(/^\/+/, '');
      createPathFor('/bundle/' + clean);
      assimpjs.FS_createDataFile('/bundle/' + path.dirname(clean).replace(/\\/g,'/'), path.basename(clean), files[name], true, true);
    }

    // Pick a main model file
    const preferred = ['glb','gltf','fbx','obj','dae','stl','ply','3ds','blend'];
    let chosen = null;
    for (const e of preferred) {
      chosen = names.find(n => path.extname(n).toLowerCase() === '.' + e && isModel(n));
      if (chosen) break;
    }
    if (!chosen) {
      console.error('ZIP bundle has no supported model file');
      process.exit(3);
    }
    inputName = 'bundle/' + chosen.replace(/\\/g,'/').replace(/^\/+/, '');
  } else {
    const data = await fs.readFile(inputPath);
    assimpjs.FS_createDataFile('/', base, data, true, true);
  }

  // Export GLB
  const result = assimpjs.ConvertFile(inputName, 'glb');
  if (!result || !result.length) {
    console.error('Conversion failed: no output from assimp');
    process.exit(3);
  }

  // assimpjs returns an array of files [{filename, data}]
  const glb = result.find(f => (f.filename || '').toLowerCase().endsWith('.glb')) || result[0];
  if (!glb?.data) {
    console.error('Conversion failed: missing GLB data');
    process.exit(3);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(glb.data));
  console.log(JSON.stringify({ ok: true, inputExt: ext, out: outputPath, bytes: glb.data.length }));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

