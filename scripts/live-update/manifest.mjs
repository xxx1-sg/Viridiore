#!/usr/bin/env node
/**
 * 生成手机热更新清单 site/ota/updates.json
 *
 * 用法：
 *   node scripts/live-update/manifest.mjs \
 *     --version 2.6.3 \
 *     --zip site/ota/bundle-2.6.3.zip \
 *     --base https://xxx1-sg.github.io/Viridiore/ota
 *
 * 输出：{ version, url, checksum } 到 site/ota/updates.json
 * （Capgo 用 checksum 校验 zip，必须与实际上传的 zip 一致）
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const version = String(arg('--version') || '').replace(/^v/i, '');
  if (!version) {
    console.error('缺少 --version（如 --version 2.6.3）');
    process.exit(1);
  }

  const zipPath = path.resolve(ROOT, arg('--zip', `site/ota/bundle-${version}.zip`));
  const base = String(arg('--base', 'https://xxx1-sg.github.io/Viridiore/ota')).replace(/\/$/, '');

  let buf;
  try {
    buf = await readFile(zipPath);
  } catch {
    console.error(`找不到 zip：${zipPath}\n请先打包：cd dist && zip -r "../site/ota/bundle-${version}.zip" .`);
    process.exit(1);
  }

  const checksum = createHash('sha256').update(buf).digest('hex');
  const manifest = {
    version,
    url: `${base}/bundle-${version}.zip`,
    checksum,
    size: buf.length,
    generatedAt: new Date().toISOString()
  };

  const outDir = path.join(ROOT, 'site', 'ota');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'updates.json');
  await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`已写入 ${path.relative(ROOT, outFile)}`);
  console.log(JSON.stringify(manifest, null, 2));
  console.log('\n下一步：把该 zip 和 updates.json 一起部署到 GitHub Pages（site/ota/）。');
}

main().catch((err) => {
  console.error('生成清单失败：', err);
  process.exit(1);
});
