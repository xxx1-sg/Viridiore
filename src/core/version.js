/** 版本号工具（纯函数，供更新服务与单测共用；不依赖 DOM） */

/** "v1.2.3" / "1.2.3" → [1,2,3] */
export function versionTuple(v) {
  return String(v == null ? '' : v)
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** a>b→1，a<b→-1，相等→0 */
export function compareVersion(a, b) {
  const A = versionTuple(a);
  const B = versionTuple(b);
  const len = Math.max(A.length, B.length, 3);
  for (let i = 0; i < len; i += 1) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** 构建时注入的版本号 */
export function currentVersion() {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
}
