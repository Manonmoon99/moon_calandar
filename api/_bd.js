// Biodynamic (Maria Thun) calendar core, ported from index.html's client-side JS
// so it can run server-side in a Vercel serverless function (no browser/DOM).
const Astronomy = require('astronomy-engine');

const PLANT_TYPES = {
  Root: { name: '根日', icon: '🥕', do: '播種、定植、採收根莖類（蘿蔔、薑、馬鈴薯）；此日採收的根菜最耐儲存。', avoid: '果菜、葉菜、花卉的播種擇日，各選對應日。' },
  Leaf: { name: '葉日', icon: '🌿', do: '播種、定植葉菜類；割草促進再生。', avoid: '採收任何作物儲存（易腐爛），釀漬醃菜也不宜。' },
  Flower: { name: '花日', icon: '🌼', do: '播種花卉與花菜類（青花菜、花椰菜）；採收花草藥草，利乾燥保香。', avoid: '根果葉作物的播種擇日，各選對應日。' },
  Fruit: { name: '果日', icon: '🍎', do: '播種、定植果菜類（番茄、豆類、瓜果）；採收水果與種子最耐存、留種發芽率佳。', avoid: '儲存性採收勿選葉日；移栽另看下降月。' },
  Ban: { name: '休息日', icon: '🚫', do: '整理農具環境、規劃農事。', avoid: '播種、定植、嫁接、儲存性採收。' },
};
const MOON_PATH = {
  Ascending: { name: '上升', icon: '⤴️', do: '嫁接、採接穗；採收鮮食蔬果。播種只看器官日，上升月可播。', avoid: '移栽定植、修剪（樹液上行，傷口流失大）。' },
  Descending: { name: '下降', icon: '⤵️', do: '移栽定植、施堆肥、修剪；根系易著土。播種只看器官日，下降月可播。', avoid: '嫁接、採接穗。' },
};
const PATH_HINT = {
  Ascending: '⤴️ 上升月：適合嫁接、採接穗、採收鮮食蔬果｜播種只看器官日，今天可播',
  Descending: '⤵️ 下降月：適合移栽定植、施堆肥、修剪｜播種只看器官日，今天可播',
};
const ZODIAC_SYMBOLS = { 白羊: '♈', 金牛: '♉', 雙子: '♊', 巨蟹: '♋', 獅子: '♌', 處女: '♍', 天秤: '♎', 天蠍: '♏', 射手: '♐', 摩羯: '♑', 水瓶: '♒', 雙魚: '♓' };
const SIGN_INFO = {
  白羊: { type: 'Fruit' }, 金牛: { type: 'Root' }, 雙子: { type: 'Flower' }, 巨蟹: { type: 'Leaf' },
  獅子: { type: 'Fruit' }, 處女: { type: 'Root' }, 天秤: { type: 'Flower' }, 天蠍: { type: 'Leaf' },
  射手: { type: 'Fruit' }, 摩羯: { type: 'Root' }, 水瓶: { type: 'Flower' }, 雙魚: { type: 'Leaf' },
};
const IAU_TO_SIGN = {
  Aries: '白羊', Taurus: '金牛', Gemini: '雙子', Cancer: '巨蟹',
  Leo: '獅子', Virgo: '處女', Libra: '天秤', Scorpius: '天蠍',
  Ophiuchus: '天蠍', Sagittarius: '射手', Capricornus: '摩羯',
  Aquarius: '水瓶', Pisces: '雙魚',
};
const ECLIPTIC_BOUNDS = [
  { start: 29.05, name: '白羊' }, { start: 53.78, name: '金牛' },
  { start: 90.51, name: '雙子' }, { start: 118.35, name: '巨蟹' },
  { start: 138.40, name: '獅子' }, { start: 174.22, name: '處女' },
  { start: 218.18, name: '天秤' }, { start: 241.41, name: '天蠍' },
  { start: 266.60, name: '射手' }, { start: 300.02, name: '摩羯' },
  { start: 327.85, name: '水瓶' }, { start: 352.02, name: '雙魚' },
];

const autoEventCache = {};

function astroTime(timestamp) { return Astronomy.MakeTime(new Date(timestamp)); }

function moonEquatorial(timestamp) {
  const vec = Astronomy.GeoMoon(astroTime(timestamp));
  return Astronomy.EquatorFromVector(vec);
}

function signFromEclipticLon(lon) {
  let current = '雙魚';
  for (const b of ECLIPTIC_BOUNDS) { if (lon >= b.start) current = b.name; }
  return current;
}

function getSignForTimestamp(timestamp) {
  const eq = moonEquatorial(timestamp);
  const iau = Astronomy.Constellation(eq.ra, eq.dec).name;
  if (IAU_TO_SIGN[iau]) return IAU_TO_SIGN[iau];
  return signFromEclipticLon(Astronomy.EclipticGeoMoon(astroTime(timestamp)).lon);
}

function getMoonPathRaw(timestamp) {
  const before = moonEquatorial(timestamp - 30 * 60000).dec;
  const after = moonEquatorial(timestamp + 30 * 60000).dec;
  return after >= before ? 'Ascending' : 'Descending';
}

function makeAstroEvent(ms, type, label, beforeHours, afterHours) {
  return {
    ms, type, label, beforeHours, afterHours,
    startMs: ms - beforeHours * 60 * 60 * 1000,
    endMs: ms + afterHours * 60 * 60 * 1000,
  };
}

function generateAutoAstroEvents(year) {
  if (autoEventCache[year]) return autoEventCache[year];

  const yearStart = Date.UTC(year, 0, 1) - 3 * 24 * 60 * 60 * 1000;
  const yearEnd = Date.UTC(year + 1, 0, 1) + 3 * 24 * 60 * 60 * 1000;
  const startTime = astroTime(yearStart);
  const events = [];

  let node = Astronomy.SearchMoonNode(startTime);
  while (node.time.date.getTime() < yearEnd) {
    events.push(makeAstroEvent(node.time.date.getTime(), 'node', '交點', 12, 12));
    node = Astronomy.NextMoonNode(node);
  }

  let apsis = Astronomy.SearchLunarApsis(startTime);
  while (apsis.time.date.getTime() < yearEnd) {
    const isApogee = apsis.kind === 1;
    events.push(makeAstroEvent(apsis.time.date.getTime(),
      isApogee ? 'apogee' : 'perigee', isApogee ? '遠地點' : '近地點', 12, 12));
    apsis = Astronomy.NextLunarApsis(apsis);
  }

  let lunar = Astronomy.SearchLunarEclipse(startTime);
  while (lunar.peak.date.getTime() < yearEnd) {
    if (lunar.kind !== 'penumbral') {
      events.push(makeAstroEvent(lunar.peak.date.getTime(), 'lunarEclipse',
        lunar.kind === 'total' ? '月全食' : '月偏食', 24, 24));
    }
    lunar = Astronomy.NextLunarEclipse(lunar.peak);
  }

  let solar = Astronomy.SearchGlobalSolarEclipse(startTime);
  while (solar.peak.date.getTime() < yearEnd) {
    events.push(makeAstroEvent(solar.peak.date.getTime(), 'solarEclipse', '日食', 24, 24));
    solar = Astronomy.NextGlobalSolarEclipse(solar.peak);
  }

  const sorted = events.sort((a, b) => a.ms - b.ms);
  autoEventCache[year] = sorted;
  return sorted;
}

function getAstroEventsForRange(startMs, endMs) {
  const years = new Set([new Date(startMs).getUTCFullYear(), new Date(endMs).getUTCFullYear()]);
  const events = [];
  years.forEach((year) => events.push(...generateAutoAstroEvents(year)));
  return events
    .filter((event) => event.endMs > startMs && event.startMs < endMs)
    .sort((a, b) => a.ms - b.ms);
}

function getUnfavorableEvent(timestamp) {
  const year = new Date(timestamp).getUTCFullYear();
  const matches = generateAutoAstroEvents(year).filter((event) => timestamp >= event.startMs && timestamp < event.endMs);
  if (!matches.length) return null;
  return matches.find((event) => event.type.includes('Eclipse')) || matches[0];
}

function moonStateKey(timestamp) {
  return getSignForTimestamp(timestamp) + '|' + getMoonPathRaw(timestamp);
}

function findSignBoundaries(startMs, endMs) {
  const boundaries = [];
  const stepMs = 2 * 60 * 60 * 1000;
  let left = startMs;
  let leftState = moonStateKey(left + 60 * 1000);

  for (let right = Math.min(startMs + stepMs, endMs); right <= endMs; right += stepMs) {
    const cappedRight = Math.min(right, endMs);
    const rightState = moonStateKey(cappedRight - 60 * 1000);
    if (rightState !== leftState) {
      let lo = left;
      let hi = cappedRight;
      for (let i = 0; i < 24; i++) {
        const mid = Math.floor((lo + hi) / 2);
        if (moonStateKey(mid) === leftState) lo = mid;
        else hi = mid;
      }
      boundaries.push(Math.round(hi / 60000) * 60000);
      leftState = rightState;
    }
    left = cappedRight;
    if (cappedRight >= endMs) break;
  }
  return boundaries;
}

function localTimeLabel(timestamp, userOffset) {
  const local = new Date(timestamp + userOffset * 60 * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

function getMoonData(timestamp, hemisphere) {
  const signName = getSignForTimestamp(timestamp);
  const unfavorableEvent = getUnfavorableEvent(timestamp);
  const isBan = Boolean(unfavorableEvent);

  let effectivePath = getMoonPathRaw(timestamp);
  if (hemisphere === 'S') {
    effectivePath = effectivePath === 'Ascending' ? 'Descending' : 'Ascending';
  }

  return {
    zodiac: signName + '座',
    symbol: ZODIAC_SYMBOLS[signName],
    plantType: isBan ? 'Ban' : SIGN_INFO[signName].type,
    pathType: effectivePath,
    isBan,
    eventLabel: unfavorableEvent ? unfavorableEvent.label : '',
  };
}

function getMoonPhaseState(timestamp) {
  const phaseAngle = Astronomy.MoonPhase(astroTime(timestamp));
  const age = (phaseAngle / 360) * 29.53;
  let emoji = '🌑';
  let text = '新月';
  if (age > 1.5) { emoji = '🌒'; text = '眉月'; }
  if (age > 6) { emoji = '🌓'; text = '上弦'; }
  if (age > 9) { emoji = '🌔'; text = '盈凸'; }
  if (age > 13.5) { emoji = '🌕'; text = '滿月'; }
  if (age > 16) { emoji = '🌖'; text = '虧凸'; }
  if (age > 20.5) { emoji = '🌗'; text = '下弦'; }
  if (age > 23.5) { emoji = '🌘'; text = '殘月'; }
  return { text, icon: emoji };
}

function getLunarDateStr(d) {
  try {
    const formatter = new Intl.DateTimeFormat('zh-TW', { calendar: 'chinese', day: 'numeric', month: 'numeric' });
    const parts = formatter.formatToParts(d);
    const m = parseInt(parts.find((p) => p.type === 'month').value, 10);
    const dVal = parseInt(parts.find((p) => p.type === 'day').value, 10);
    const cnM = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '臘月'];
    const cnD = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
    return `農曆 ${cnM[m] || `${m}月`}${cnD[dVal] || `${dVal}日`}`;
  } catch (e) {
    return '';
  }
}

function getSolarTerm(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 1) { if (day < 6) return '冬至後'; if (day < 20) return '小寒'; return '大寒'; }
  if (m === 2) { if (day < 4) return '大寒後'; if (day < 19) return '立春'; return '雨水'; }
  if (m === 3) { if (day < 6) return '雨水後'; if (day < 21) return '驚蟄'; return '春分'; }
  if (m === 4) { if (day < 5) return '春分後'; if (day < 20) return '清明'; return '穀雨'; }
  if (m === 5) { if (day < 6) return '穀雨後'; if (day < 21) return '立夏'; return '小滿'; }
  if (m === 6) { if (day < 6) return '小滿後'; if (day < 21) return '芒種'; return '夏至'; }
  if (m === 7) { if (day < 7) return '夏至後'; if (day < 23) return '小暑'; return '大暑'; }
  if (m === 8) { if (day < 8) return '大暑後'; if (day < 23) return '立秋'; return '處暑'; }
  if (m === 9) { if (day < 8) return '處暑後'; if (day < 23) return '白露'; return '秋分'; }
  if (m === 10) { if (day < 8) return '秋分後'; if (day < 23) return '寒露'; return '霜降'; }
  if (m === 11) { if (day < 7) return '霜降後'; if (day < 22) return '立冬'; return '小雪'; }
  if (m === 12) { if (day < 7) return '小雪後'; if (day < 22) return '大雪'; return '冬至'; }
  return '';
}

function sameDisplayState(a, b) {
  if (!a || !b) return false;
  if (a.data.plantType === 'Ban' && b.data.plantType === 'Ban') return true;
  return a.data.plantType === b.data.plantType && a.data.zodiac === b.data.zodiac;
}

// dateObj: a Date whose Y/M/D (in server-local/UTC fields, doesn't matter which,
// only the calendar date parts are read) identifies the calendar day to compute,
// interpreted in userOffset's timezone.
function getDayEvents(y, m, d, userOffset, hemisphere) {
  const startMs = Date.UTC(y, m, d) - userOffset * 60 * 60 * 1000;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const boundaries = new Set([startMs, endMs]);

  findSignBoundaries(startMs, endMs).forEach((boundary) => {
    if (boundary > startMs && boundary < endMs) boundaries.add(boundary);
  });
  getAstroEventsForRange(startMs, endMs).forEach((event) => {
    if (event.startMs > startMs && event.startMs < endMs) boundaries.add(event.startMs);
    if (event.endMs > startMs && event.endMs < endMs) boundaries.add(event.endMs);
  });

  const points = Array.from(boundaries).sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const midpoint = start + Math.floor((end - start) / 2);
    const segment = {
      data: getMoonData(midpoint, hemisphere),
      startMs: start,
      endMs: end,
      startTime: localTimeLabel(start, userOffset),
      endTime: end === endMs ? '24:00' : localTimeLabel(end, userOffset),
    };
    const previous = segments[segments.length - 1];
    if (sameDisplayState(previous, segment)) {
      previous.endMs = segment.endMs;
      previous.endTime = segment.endTime;
      if (segment.data.eventLabel && !previous.data.eventLabel.includes(segment.data.eventLabel)) {
        previous.data.eventLabel = previous.data.eventLabel
          ? `${previous.data.eventLabel}/${segment.data.eventLabel}`
          : segment.data.eventLabel;
      }
    } else {
      segments.push(segment);
    }
  }
  return segments;
}

function buildTodayPayload(now, userOffset, hemisphere) {
  const local = new Date(now.getTime() + userOffset * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const dateForCalendarFns = new Date(y, m, d);

  const rawSegments = getDayEvents(y, m, d, userOffset, hemisphere);
  const phase = getMoonPhaseState(now.getTime());

  const segments = rawSegments.map((seg) => {
    const plant = PLANT_TYPES[seg.data.plantType];
    const path = MOON_PATH[seg.data.pathType];
    return {
      startTime: seg.startTime,
      endTime: seg.endTime,
      zodiac: seg.data.zodiac,
      symbol: seg.data.symbol,
      isBan: seg.data.isBan,
      eventLabel: seg.data.eventLabel,
      plant: { type: seg.data.plantType, name: plant.name, icon: plant.icon, do: plant.do, avoid: plant.avoid },
      path: { type: seg.data.pathType, name: path.name, icon: path.icon, do: path.do, avoid: path.avoid },
      pathHint: seg.data.isBan ? null : PATH_HINT[seg.data.pathType],
    };
  });

  return {
    date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    weekday: ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][dateForCalendarFns.getDay()],
    lunar: getLunarDateStr(dateForCalendarFns),
    solarTerm: getSolarTerm(dateForCalendarFns),
    moonPhase: phase,
    timezone: `UTC${userOffset >= 0 ? '+' : ''}${userOffset}`,
    hemisphere,
    segments,
  };
}

module.exports = { buildTodayPayload };
