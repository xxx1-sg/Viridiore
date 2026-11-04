# 反馈样本收件箱

把用户从「设置 → 导出反馈样本（匿名）」得到的 JSON 放进这个目录，然后运行：

```bash
npm run ledger:feedback      # 校验 → 按 sampleKey 去重 → 写入 data/feedback/merged.json
npm run ledger:report        # 把用户打卡并入 data/ledger.json / ledger.md
npm run ledger:scorecard     # 刷新 README 顶部的回测记分牌
```

## 口径

- 这些是 **basis: user** 的「用户打卡」，回答的是“有没有人看到”，
  和 ERA5 再分析的 **basis: reanalysis**「气象条件是否成立」**分列统计，绝不合并成一个数字**。
- 样本只含：山峰 id、模式、日期、预测概率、结果、来源、时间戳。
  不含轨迹坐标、设备信息、账号或自由文本（`src/services/feedback.js` 的 `toAnonymousSample` 白名单控制）。
- 重复导入是幂等的：同一条样本的 `sampleKey` 相同，不会重复计数。

## 为什么是手动收件箱

项目没有后端，也不打算为了“收集反馈”引入账号体系。真实做法是：
愿意贡献的用户导出 JSON 发给你，你丢进这个目录跑一次合并。
这比偷偷上报干净，也比如实说明“样本还很少”诚实。
