/** 装备清单预设模板 */

export const GEAR_PRESETS = {
  day: {
    name: '一日徒步',
    items: [
      { name: '登山杖', qty: 2, group: 'gear' },
      { name: '头灯 + 备用电池', qty: 1, group: 'gear' },
      { name: '1.5L 饮水', qty: 1, group: 'food' },
      { name: '能量胶 / 坚果', qty: 2, group: 'food' },
      { name: '冲锋衣', qty: 1, group: 'clothing' },
      { name: '速干衣裤', qty: 1, group: 'clothing' },
      { name: '防晒帽 + 冰袖', qty: 1, group: 'clothing' },
      { name: '急救包', qty: 1, group: 'survival' },
      { name: '保温毯', qty: 1, group: 'survival' },
      { name: '充电宝', qty: 1, group: 'gear' },
      { name: '垃圾袋', qty: 1, group: 'survival' }
    ]
  },
  camp: {
    name: '露营过夜',
    items: [
      { name: '帐篷（含地钉）', qty: 1, group: 'gear' },
      { name: '睡袋（按温标）', qty: 1, group: 'gear' },
      { name: '防潮垫', qty: 1, group: 'gear' },
      { name: '炉头 + 气罐', qty: 1, group: 'food' },
      { name: '锅具 + 餐具', qty: 1, group: 'food' },
      { name: '3L 饮水', qty: 1, group: 'food' },
      { name: '营地灯', qty: 1, group: 'gear' },
      { name: '驱蚊液', qty: 1, group: 'survival' },
      { name: '急救包', qty: 1, group: 'survival' },
      { name: '保暖中层', qty: 1, group: 'clothing' },
      { name: '雨衣', qty: 1, group: 'clothing' }
    ]
  },
  stream: {
    name: '溯溪',
    items: [
      { name: '溯溪鞋', qty: 1, group: 'clothing' },
      { name: '头盔', qty: 1, group: 'gear' },
      { name: '防水袋', qty: 2, group: 'gear' },
      { name: '救生衣', qty: 1, group: 'gear' },
      { name: '绳索 20m', qty: 1, group: 'gear' },
      { name: '速干衣', qty: 1, group: 'clothing' },
      { name: '创可贴 / 碘伏', qty: 1, group: 'survival' },
      { name: '电解质水', qty: 1, group: 'food' }
    ]
  },
  winter: {
    name: '冬季高山',
    items: [
      { name: '硬壳冲锋衣裤', qty: 1, group: 'clothing' },
      { name: '抓绒 / 羽绒中层', qty: 1, group: 'clothing' },
      { name: '保暖手套', qty: 1, group: 'clothing' },
      { name: '毛线帽', qty: 1, group: 'clothing' },
      { name: '雪套', qty: 1, group: 'gear' },
      { name: '冰爪', qty: 1, group: 'gear' },
      { name: '保温壶', qty: 1, group: 'food' },
      { name: '高热量食物', qty: 1, group: 'food' },
      { name: '急救包 + 保温毯', qty: 1, group: 'survival' },
      { name: '对讲机', qty: 1, group: 'gear' }
    ]
  }
};

/** 默认清单（首次进入时写入） */
export const DEFAULT_GEAR = GEAR_PRESETS.day;
