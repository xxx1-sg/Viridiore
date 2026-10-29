/**
 * electron-builder afterPack 钩子（仅 Windows）。
 *
 * 背景：electron-builder 自带的 rcedit 步骤依赖 winCodeSign 资源包，而该包内的
 * macOS 软链接在没有符号链接权限的 Windows 上解压失败。因此 build 配置里关闭了
 * signAndEditExecutable，改由本脚本直接调用 rcedit 写入图标与版本信息。
 */
const { execFileSync } = require('node:child_process');
const { existsSync, readdirSync, statSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** 在 electron-builder 缓存里找一个可用的 rcedit */
function findRcedit() {
  if (process.env.MOSSY_RCEDIT && existsSync(process.env.MOSSY_RCEDIT)) return process.env.MOSSY_RCEDIT;

  const cacheRoot = path.join(os.homedir(), '.cache', 'electron-builder', 'winCodeSign');
  const candidates = [path.join(cacheRoot, '2.6.0', 'rcedit-x64.exe')];

  if (existsSync(cacheRoot)) {
    for (const name of readdirSync(cacheRoot)) {
      const dir = path.join(cacheRoot, name);
      try {
        if (statSync(dir).isDirectory()) candidates.push(path.join(dir, 'rcedit-x64.exe'));
      } catch {
        /* 忽略无法访问的条目 */
      }
    }
  }

  return candidates.find((p) => existsSync(p)) || null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appName = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${appName}.exe`);
  if (!existsSync(exePath)) {
    console.warn(`[after-pack] 未找到可执行文件：${exePath}`);
    return;
  }

  const rcedit = findRcedit();
  if (!rcedit) {
    console.warn('[after-pack] 未找到 rcedit，跳过图标与版本信息写入（可设置 MOSSY_RCEDIT 指向 rcedit 可执行文件）');
    return;
  }

  const root = context.packager.projectDir;
  const iconPath = path.join(root, 'build', 'icon.ico');
  const pkg = require(path.join(root, 'package.json'));
  const version = `${pkg.version}.0`;

  const args = [
    exePath,
    '--set-file-version', version,
    '--set-product-version', version,
    '--set-version-string', 'ProductName', pkg.productName || '晓山青',
    '--set-version-string', 'FileDescription', pkg.description || '晓山青',
    '--set-version-string', 'CompanyName', pkg.author || 'Mossy Dawn',
    '--set-version-string', 'LegalCopyright', 'Copyright © 2026 Mossy Dawn',
    '--set-version-string', 'OriginalFilename', `${appName}.exe`
  ];

  if (existsSync(iconPath)) {
    args.push('--set-icon', iconPath);
  }

  try {
    execFileSync(rcedit, args, { stdio: 'pipe' });
    console.log(`[after-pack] 已写入图标与版本信息：${path.basename(exePath)} v${version}`);
  } catch (error) {
    console.warn(`[after-pack] rcedit 执行失败：${error.message}`);
  }
};
