/**
 * 山峰数据集（用于追光推荐、AI 知识库、路书）
 * 坐标为山顶大致位置，仅用于天气查询参考。
 */

export const MOUNTAINS = [
  {
    id: 'wutong',
    name: '梧桐山',
    elevation: 943,
    lat: 22.581,
    lon: 114.219,
    area: '罗湖 / 盐田',
    season: '10 月 — 次年 3 月',
    desc: '深圳第一峰，主峰大梧桐。云海与日出最经典，秋冬清晨湿度大时云海概率高。',
    tags: ['云海', '日出', '深圳十峰'],
    difficulty: 3,
    route: { distance: 11.2, ascent: 820, hours: 5.5 }
  },
  {
    id: 'qiniang',
    name: '七娘山',
    elevation: 869,
    lat: 22.548,
    lon: 114.561,
    area: '大鹏新区',
    season: '11 月 — 次年 4 月',
    desc: '深圳第二峰，三面环海，山脊视野极佳。坡度陡、以碎石路为主。',
    tags: ['海景', '日出', '强度高'],
    difficulty: 4,
    route: { distance: 9.6, ascent: 760, hours: 6 }
  },
  {
    id: 'maluan',
    name: '马峦山',
    elevation: 590,
    lat: 22.629,
    lon: 114.33,
    area: '坪山新区',
    season: '四季皆宜',
    desc: '瀑布群与百年梅花，路径成熟，适合轻装徒步和亲子出行。',
    tags: ['瀑布', '亲子', '新手友好'],
    difficulty: 2,
    route: { distance: 8.4, ascent: 420, hours: 3.5 }
  },
  {
    id: 'paiya',
    name: '排牙山',
    elevation: 707,
    lat: 22.593,
    lon: 114.487,
    area: '大鹏新区',
    season: '11 月 — 次年 3 月',
    desc: '锯齿状山脊，两侧临海，被称为深圳最险的穿越线路，需要手脚并用。',
    tags: ['山脊', '挑战', '海景'],
    difficulty: 5,
    route: { distance: 12.8, ascent: 880, hours: 7 }
  },
  {
    id: 'meishajian',
    name: '梅沙尖',
    elevation: 753,
    lat: 22.607,
    lon: 114.36,
    area: '盐田区',
    season: '10 月 — 次年 4 月',
    desc: '深圳第三高峰，山顶可俯瞰大小梅沙与盐田港，日出方向正对海平面。',
    tags: ['日出', '海景', '深圳十峰'],
    difficulty: 3,
    route: { distance: 7.8, ascent: 640, hours: 4 }
  },
  {
    id: 'tanglang',
    name: '塘朗山',
    elevation: 430,
    lat: 22.586,
    lon: 113.993,
    area: '南山区',
    season: '四季皆宜',
    desc: '城市绿肺，登山道完善，傍晚可看落日与城市灯光，通勤后夜爬首选。',
    tags: ['城市', '夜爬', '新手友好'],
    difficulty: 2,
    route: { distance: 5.6, ascent: 330, hours: 2.5 }
  },
  {
    id: 'fenghuang',
    name: '凤凰山',
    elevation: 376,
    lat: 22.686,
    lon: 113.846,
    area: '宝安区',
    season: '四季皆宜',
    desc: '古村、寺庙与森林并存，石阶路为主，适合半天轻徒步。',
    tags: ['人文', '轻徒步', '新手友好'],
    difficulty: 1,
    route: { distance: 4.2, ascent: 260, hours: 2 }
  },
  {
    id: 'yangtaishan',
    name: '阳台山',
    elevation: 587,
    lat: 22.632,
    lon: 113.988,
    area: '龙华 / 宝安',
    season: '10 月 — 次年 5 月',
    desc: '溪谷与瀑布众多，雨季水量充沛，注意湿滑与蚊虫。',
    tags: ['溪谷', '瀑布', '避暑'],
    difficulty: 2,
    route: { distance: 7.1, ascent: 480, hours: 3.5 }
  },
  {
    id: 'dananshan',
    name: '大南山',
    elevation: 336,
    lat: 22.491,
    lon: 113.913,
    area: '南山区',
    season: '四季皆宜',
    desc: '山顶可同时看到前海与蛇口港，日落与城市天际线是最大看点。',
    tags: ['日落', '城市', '轻徒步'],
    difficulty: 1,
    route: { distance: 3.8, ascent: 220, hours: 1.8 }
  },
  {
    id: 'luofu',
    name: '罗浮山',
    elevation: 1296,
    lat: 23.268,
    lon: 114.056,
    area: '惠州 · 博罗',
    season: '11 月 — 次年 4 月',
    desc: '岭南第一山，飞云顶云海概率高，适合两日重装或一日强穿。',
    tags: ['云海', '重装', '外线'],
    difficulty: 4,
    route: { distance: 16.5, ascent: 1100, hours: 8 }
  },
  {
    id: 'nankun',
    name: '南昆山',
    elevation: 1228,
    lat: 23.635,
    lon: 113.86,
    area: '惠州 · 龙门',
    season: '四季皆宜',
    desc: '北回归线上的森林氧吧，夏季避暑、秋季观星，车程约 2 小时。',
    tags: ['森林', '避暑', '观星'],
    difficulty: 3,
    route: { distance: 10.2, ascent: 700, hours: 5 }
  },
  {
    id: 'yinhu',
    name: '银湖山',
    elevation: 445,
    lat: 22.586,
    lon: 114.103,
    area: '罗湖 / 福田',
    season: '四季皆宜',
    desc: '市区内少见的连片山脊绿道，适合晨跑与短距越野训练。',
    tags: ['越野跑', '绿道', '城市'],
    difficulty: 2,
    route: { distance: 6.4, ascent: 380, hours: 2.5 }
  }
];

export const mountainById = (id) => MOUNTAINS.find((m) => m.id === id) || MOUNTAINS[0];

/** 城市 / 区域（天气切换用） */
export const CITIES = [
  { name: '深圳', lat: 22.5431, lon: 114.0579, group: '深圳' },
  { name: '福田区', lat: 22.541, lon: 114.055, group: '深圳' },
  { name: '罗湖区', lat: 22.548, lon: 114.131, group: '深圳' },
  { name: '南山区', lat: 22.533, lon: 113.93, group: '深圳' },
  { name: '盐田区', lat: 22.557, lon: 114.237, group: '深圳' },
  { name: '宝安区', lat: 22.555, lon: 113.883, group: '深圳' },
  { name: '龙岗区', lat: 22.72, lon: 114.246, group: '深圳' },
  { name: '龙华区', lat: 22.696, lon: 114.045, group: '深圳' },
  { name: '坪山区', lat: 22.69, lon: 114.346, group: '深圳' },
  { name: '光明区', lat: 22.748, lon: 113.936, group: '深圳' },
  { name: '大鹏新区', lat: 22.596, lon: 114.479, group: '深圳' },
  { name: '广州', lat: 23.1291, lon: 113.2644, group: '周边' },
  { name: '惠州', lat: 23.1115, lon: 114.4162, group: '周边' },
  { name: '东莞', lat: 23.0207, lon: 113.7518, group: '周边' },
  { name: '珠海', lat: 22.2707, lon: 113.5767, group: '周边' }
];
