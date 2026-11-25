/** version.js 单元测试 —— 版本比较是更新判定的地基，先钉死。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { versionTuple, compareVersion } from '../src/core/version.js';

test('versionTuple：去掉 v 前缀并拆数字', () => {
  assert.deepEqual(versionTuple('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(versionTuple('2.6.2'), [2, 6, 2]);
  assert.deepEqual(versionTuple(''), [0]);
});

test('compareVersion：数值比较，不是字符串比较', () => {
  assert.equal(compareVersion('2.10.0', '2.9.0'), 1, '2.10 应大于 2.9（字符串比较会错）');
  assert.equal(compareVersion('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersion('v1.2.3', '1.2.4'), -1);
  assert.equal(compareVersion('2.6.2', 'v2.6.2'), 0);
});

test('compareVersion：位数不同按缺省 0 处理', () => {
  assert.equal(compareVersion('1.2', '1.2.0'), 0);
  assert.equal(compareVersion('1.2.1', '1.2'), 1);
  assert.equal(compareVersion('1.3', '1.2.9'), 1);
});
