/**
 * 山峰数据集（用于追光推荐、AI 知识库、路书）
 * 坐标为山顶大致位置，仅用于天气查询参考。
 *
 * `valleyElevation`：登山口 / 谷底海拔，约等于云海抬升的起算面。
 * 追光模型用它（与天气格点海拔取较小值）作为云底参考面，见 services/chase.js 的 cloudGeometry。
 * 数值取主要登山口或谷地村镇海拔的近似值，属一阶估计（几十米量级误差不改判）。
 *
 * `travel`：出行档案（离线人工整理，非实时导航数据）。
 *   ascentHours  主要登山口到山顶的参考用时（小时，按常速徒步估算）
 *   trailheads   常用登山口名称，仅用于提示方向
 *   drive        自驾：导航目标与停车情况
 *   transit      公共交通：level 表示可达程度 metro / bus / none，label 为站点或换乘方式
 *   taxi         打车 / 拼车说明
 *   gear/safety  装备与安全提示的固定项，运行时会再按当天天气追加
 * 说明：不写具体公交线路号与票价，避免给出会过期的编造信息；
 * 距离与耗时由 services/travel.js 依据用户位置实时折算，界面上标注为「参考」。
 */

export const MOUNTAINS = [
  {
    id: 'wutong',
    name: '梧桐山',
    elevation: 943,
    valleyElevation: 60,
    lat: 22.581,
    lon: 114.219,
    area: '罗湖 / 盐田',
    season: '10 月 — 次年 3 月',
    desc: '深圳第一峰，主峰大梧桐。云海与日出最经典，秋冬清晨湿度大时云海概率高。',
    tags: ['云海', '日出', '深圳十峰'],
    difficulty: 3,
    route: { distance: 11.2, ascent: 820, hours: 5.5 },
    travel: {
      ascentHours: 2.5,
      trailheads: ['北大门（大望村）', '梧桐山南 / 莲塘一侧入口'],
      drive: {
        nav: '导航「梧桐山风景区北大门」',
        parking: '北大门、横排岭有停车场，节假日 8 点前到更稳妥'
      },
      transit: {
        level: 'metro',
        label: '地铁 8 号线 · 梧桐山南站',
        note: '出站打车或步行约 10 分钟到北大门'
      },
      taxi: '市区打车约 40–60 分钟；凌晨回程车少，建议提前约车',
      gear: ['登山鞋', '头灯', '薄外套'],
      safety: ['主路成熟，但石阶雨后湿滑，下山要慢', '山顶风大，比山下低 5–7℃', '凌晨下山走北大门大路，别走野径']
    }
  },
  {
    id: 'qiniang',
    name: '七娘山',
    elevation: 869,
    valleyElevation: 30,
    lat: 22.548,
    lon: 114.561,
    area: '大鹏新区',
    season: '11 月 — 次年 4 月',
    desc: '深圳第二峰，三面环海，山脊视野极佳。坡度陡、以碎石路为主。',
    tags: ['海景', '日出', '强度高'],
    difficulty: 4,
    route: { distance: 9.6, ascent: 760, hours: 6 },
    travel: {
      ascentHours: 3.5,
      trailheads: ['地质公园登山口（新大村）'],
      drive: {
        nav: '导航「深圳大鹏半岛国家地质公园」',
        parking: '地质公园停车场，节假日车位紧张'
      },
      transit: {
        level: 'bus',
        label: '市区乘 E11 等至大鹏 / 南澳，再换乘或打车',
        note: '公共交通需换乘、班次少，建议自驾'
      },
      taxi: '从市区打车约 1.5 小时，费用较高，回程需提前约',
      gear: ['登山鞋', '手套（碎石段手脚并用）', '头灯', '充足饮水'],
      safety: ['碎石陡坡多，下山更滑，控制节奏', '三面环海无遮挡，注意防晒与防风', '强度高，尽量结伴，不夜爬陌生路段']
    }
  },
  {
    id: 'maluan',
    name: '马峦山',
    elevation: 590,
    valleyElevation: 60,
    lat: 22.629,
    lon: 114.33,
    area: '坪山新区',
    season: '四季皆宜',
    desc: '瀑布群与百年梅花，路径成熟，适合轻装徒步和亲子出行。',
    tags: ['瀑布', '亲子', '新手友好'],
    difficulty: 2,
    route: { distance: 8.4, ascent: 420, hours: 3.5 },
    travel: {
      ascentHours: 1.5,
      trailheads: ['碧岭入口', '汤坑入口'],
      drive: {
        nav: '导航「马峦山郊野公园碧岭入口」',
        parking: '碧岭入口有停车场，周末建议早到'
      },
      transit: {
        level: 'bus',
        label: '地铁 14 号线至坪山，转公交 / 打车约 20 分钟',
        note: '公共交通需换乘'
      },
      taxi: '从市区打车约 1 小时',
      gear: ['运动鞋', '防晒', '驱蚊液'],
      safety: ['瀑布溪谷石头湿滑，别下水', '雨季注意山洪与落石', '亲子出行看好小孩']
    }
  },
  {
    id: 'paiya',
    name: '排牙山',
    elevation: 707,
    valleyElevation: 40,
    lat: 22.593,
    lon: 114.487,
    area: '大鹏新区',
    season: '11 月 — 次年 3 月',
    desc: '锯齿状山脊，两侧临海，被称为深圳最险的穿越线路，需要手脚并用。',
    tags: ['山脊', '挑战', '海景'],
    difficulty: 5,
    route: { distance: 12.8, ascent: 880, hours: 7 },
    travel: {
      ascentHours: 4,
      trailheads: ['坝光 / 高大村一侧入口'],
      drive: {
        nav: '导航「排牙山」或坝光方向登山口',
        parking: '入口附近车位少，尽量早到'
      },
      transit: {
        level: 'none',
        label: '无直达公共交通，建议自驾',
        note: ''
      },
      taxi: '回程偏远难打车，务必自驾或包车',
      gear: ['登山鞋', '手套', '头盔（落石风险）', '头灯', '充足饮水'],
      safety: ['山脊需手脚并用，恐高者慎行', '全程无补给、无遮阴，量力而行', '务必结伴并告知行程，不建议独自尝试']
    }
  },
  {
    id: 'meishajian',
    name: '梅沙尖',
    elevation: 753,
    valleyElevation: 30,
    lat: 22.607,
    lon: 114.36,
    area: '盐田区',
    season: '10 月 — 次年 4 月',
    desc: '深圳第三高峰，山顶可俯瞰大小梅沙与盐田港，日出方向正对海平面。',
    tags: ['日出', '海景', '深圳十峰'],
    difficulty: 3,
    route: { distance: 7.8, ascent: 640, hours: 4 },
    travel: {
      ascentHours: 2,
      trailheads: ['大梅沙 / 东部华侨城一侧入口'],
      drive: {
        nav: '导航「梅沙尖」或大梅沙登山口',
        parking: '大梅沙周边停车较紧张，建议早到'
      },
      transit: {
        level: 'metro',
        label: '地铁 8 号线 · 大梅沙站',
        note: '出站打车或步行到登山口'
      },
      taxi: '盐田方向打车方便',
      gear: ['登山鞋', '头灯', '薄外套'],
      safety: ['部分路段较陡，注意脚下', '山顶看日出人多，早到占位', '海边天气多变，带件防风衣']
    }
  },
  {
    id: 'tanglang',
    name: '塘朗山',
    elevation: 430,
    valleyElevation: 30,
    lat: 22.586,
    lon: 113.993,
    area: '南山区',
    season: '四季皆宜',
    desc: '城市绿肺，登山道完善，傍晚可看落日与城市灯光，通勤后夜爬首选。',
    tags: ['城市', '夜爬', '新手友好'],
    difficulty: 2,
    route: { distance: 5.6, ascent: 330, hours: 2.5 },
    travel: {
      ascentHours: 1.2,
      trailheads: ['龙珠门入口', '深云入口', '塘朗山郊野公园入口'],
      drive: {
        nav: '导航「塘朗山郊野公园」',
        parking: '各入口周边有停车位'
      },
      transit: {
        level: 'metro',
        label: '地铁 7 号线 · 深云站 / 龙井站',
        note: '出站步行可达登山道'
      },
      taxi: '市区打车方便，适合夜爬后打车回',
      gear: ['运动鞋', '头灯（夜爬）', '驱蚊液'],
      safety: ['夜爬走主道，务必带头灯', '傍晚蚊虫多，做好防护', '台阶较多，注意膝盖']
    }
  },
  {
    id: 'fenghuang',
    name: '凤凰山',
    elevation: 376,
    valleyElevation: 30,
    lat: 22.686,
    lon: 113.846,
    area: '宝安区',
    season: '四季皆宜',
    desc: '古村、寺庙与森林并存，石阶路为主，适合半天轻徒步。',
    tags: ['人文', '轻徒步', '新手友好'],
    difficulty: 1,
    route: { distance: 4.2, ascent: 260, hours: 2 },
    travel: {
      ascentHours: 1,
      trailheads: ['凤凰山森林公园正门'],
      drive: {
        nav: '导航「凤凰山森林公园」',
        parking: '正门有停车场'
      },
      transit: {
        level: 'bus',
        label: '地铁 11 号线至桥头 / 塘尾，转公交',
        note: '需换乘'
      },
      taxi: '宝安方向打车方便',
      gear: ['运动鞋', '防晒', '饮水'],
      safety: ['石阶为主，适合轻装', '节假日人多，错峰出行', '寺庙周边注意防火']
    }
  },
  {
    id: 'yangtaishan',
    name: '阳台山',
    elevation: 587,
    valleyElevation: 70,
    lat: 22.632,
    lon: 113.988,
    area: '龙华 / 宝安',
    season: '10 月 — 次年 5 月',
    desc: '溪谷与瀑布众多，雨季水量充沛，注意湿滑与蚊虫。',
    tags: ['溪谷', '瀑布', '避暑'],
    difficulty: 2,
    route: { distance: 7.1, ascent: 480, hours: 3.5 },
    travel: {
      ascentHours: 1.8,
      trailheads: ['大浪入口', '羊台山入口'],
      drive: {
        nav: '导航「阳台山森林公园」',
        parking: '入口有停车位，周末较紧张'
      },
      transit: {
        level: 'metro',
        label: '地铁 6 号线 · 阳台山东站',
        note: '出站打车或步行到入口'
      },
      taxi: '龙华方向打车方便',
      gear: ['登山鞋', '驱蚊液', '雨具（雨季）'],
      safety: ['溪谷湿滑，雨季防山洪', '夏季蚊虫多', '部分路线岔路多，跟主路走']
    }
  },
  {
    id: 'dananshan',
    name: '大南山',
    elevation: 336,
    valleyElevation: 20,
    lat: 22.491,
    lon: 113.913,
    area: '南山区',
    season: '四季皆宜',
    desc: '山顶可同时看到前海与蛇口港，日落与城市天际线是最大看点。',
    tags: ['日落', '城市', '轻徒步'],
    difficulty: 1,
    route: { distance: 3.8, ascent: 220, hours: 1.8 },
    travel: {
      ascentHours: 0.8,
      trailheads: ['南山公园登山口', '蛇口别墅登山口'],
      drive: {
        nav: '导航「大南山公园」',
        parking: '公园周边有停车位'
      },
      transit: {
        level: 'metro',
        label: '地铁 2 号线 · 海上世界站 / 12 号线南山站',
        note: '步行或打车至登山口'
      },
      taxi: '蛇口方向打车方便',
      gear: ['运动鞋', '饮水', '防晒'],
      safety: ['台阶路为主，适合轻徒步', '看日落人多，注意台阶', '夜间灯光暗，注意脚下']
    }
  },
  {
    id: 'luofu',
    name: '罗浮山',
    elevation: 1296,
    valleyElevation: 180,
    lat: 23.268,
    lon: 114.056,
    area: '惠州 · 博罗',
    season: '11 月 — 次年 4 月',
    desc: '岭南第一山，飞云顶云海概率高，适合两日重装或一日强穿。',
    tags: ['云海', '重装', '外线'],
    difficulty: 4,
    route: { distance: 16.5, ascent: 1100, hours: 8 },
    travel: {
      ascentHours: 4,
      trailheads: ['罗浮山景区大门（朱明洞）'],
      drive: {
        nav: '导航「罗浮山风景名胜区」',
        parking: '景区停车场'
      },
      transit: {
        level: 'bus',
        label: '高铁至惠州 / 博罗，转景区专线或打车',
        note: '公共交通需换乘，耗时较长'
      },
      taxi: '不建议全程打车，费用高，适合到达后短途接驳',
      gear: ['登山鞋', '登山杖', '头灯', '保暖层', '充足饮水与路餐'],
      safety: ['两日重装或一日强穿，强度大', '山上补给少，水和食物带够', '注意天气变化，雷雨勿上山脊']
    }
  },
  {
    id: 'nankun',
    name: '南昆山',
    elevation: 1228,
    valleyElevation: 350,
    lat: 23.635,
    lon: 113.86,
    area: '惠州 · 龙门',
    season: '四季皆宜',
    desc: '北回归线上的森林氧吧，夏季避暑、秋季观星，车程约 2 小时。',
    tags: ['森林', '避暑', '观星'],
    difficulty: 3,
    route: { distance: 10.2, ascent: 700, hours: 5 },
    travel: {
      ascentHours: 2.5,
      trailheads: ['南昆山景区 / 十字水入口'],
      drive: {
        nav: '导航「南昆山国家森林公园」',
        parking: '景区停车场'
      },
      transit: {
        level: 'none',
        label: '无直达公共交通，建议自驾',
        note: '车程约 2 小时'
      },
      taxi: '距离远，不建议打车',
      gear: ['登山鞋', '驱蚊液', '雨具', '外套（避暑早晚凉）'],
      safety: ['森林茂密，走主道防迷路', '夏季避暑但蚊虫多', '山路弯多，自驾注意安全']
    }
  },
  {
    id: 'yinhu',
    name: '银湖山',
    elevation: 445,
    valleyElevation: 30,
    lat: 22.586,
    lon: 114.103,
    area: '罗湖 / 福田',
    season: '四季皆宜',
    desc: '市区内少见的连片山脊绿道，适合晨跑与短距越野训练。',
    tags: ['越野跑', '绿道', '城市'],
    difficulty: 2,
    route: { distance: 6.4, ascent: 380, hours: 2.5 },
    travel: {
      ascentHours: 1,
      trailheads: ['银湖山郊野公园入口'],
      drive: {
        nav: '导航「银湖山郊野公园」',
        parking: '入口周边有停车位'
      },
      transit: {
        level: 'metro',
        label: '地铁 6 号线 · 银湖站 / 翰岭站',
        note: '出站步行到绿道入口'
      },
      taxi: '市区打车方便',
      gear: ['运动鞋', '饮水', '驱蚊液'],
      safety: ['绿道成熟，适合晨跑 / 越野训练', '部分路段与车道相邻，注意车辆', '夜跑带头灯']
    }
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
