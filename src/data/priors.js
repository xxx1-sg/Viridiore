/**
 * 月度基准率先验（追光概率的起点）
 *
 * - `BUILTIN_PRIORS`：经验先验，作为**永远可用的兜底**（现行模型实际用的就是它）。
 * - `PRIORS`：当前生效的先验。默认等于内置值；
 *   `npm run ledger:prior -- --write`（样本足够时）会用回测重估值重写本文件的 PRIORS。
 *
 * 为什么单拎出来：先验曾被写死在 chase.js 里，回测重估时容易和脚本结果不一致。
 * 现在只有一个数据源，脚本直接写这里，模型只读这里。
 *
 * 数组索引 0–11 = 1–12 月，值为概率（0–1）。
 */
export const PRIOR_META = {
  source: 'builtin',
  samples: 0,
  monthsCovered: [],
  generatedAt: null,
  note: '经验先验，尚未用回测覆盖'
};

export const BUILTIN_PRIORS = {
  cloudsea: [0.18, 0.2, 0.16, 0.1, 0.06, 0.03, 0.02, 0.02, 0.04, 0.09, 0.16, 0.19],
  sunrise: [0.52, 0.46, 0.4, 0.32, 0.26, 0.2, 0.22, 0.22, 0.28, 0.4, 0.48, 0.52],
  stars: [0.42, 0.36, 0.28, 0.2, 0.14, 0.1, 0.12, 0.12, 0.18, 0.3, 0.38, 0.42]
};

/** 当前生效先验（默认 = 内置；可被回测重估覆盖） */
export const PRIORS = BUILTIN_PRIORS;
