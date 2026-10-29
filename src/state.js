/** 全局应用状态：位置、天气、当前山峰 */
import { bus, prefsStore } from './core/store.js';
import { loadWeather } from './services/weather.js';
import { CITIES, MOUNTAINS, mountainById } from './data/mountains.js';
import { DEMO_LOCATION } from './config.js';

const defaultCity = CITIES.find((c) => c.name === prefsStore.get('homeCity', '深圳')) || CITIES[0];

export const appState = {
  location: {
    name: defaultCity.name,
    lat: defaultCity.lat ?? DEMO_LOCATION.lat,
    lon: defaultCity.lon ?? DEMO_LOCATION.lon
  },
  weather: null,
  weatherStatus: 'idle', // idle | loading | ready | error
  weatherError: '',
  mountainId: MOUNTAINS[0].id,
  myPosition: null
};

let inflight = null;

export function currentMountain() {
  return mountainById(appState.mountainId);
}

export function setMountain(id) {
  appState.mountainId = id;
  prefsStore.set({ mountainId: id });
  bus.emit('mountain:change', id);
}

export function setLocation({ name, lat, lon }) {
  appState.location = { name, lat, lon };
  prefsStore.set({ homeCity: name });
  appState.weather = null;
  bus.emit('location:change', appState.location);
}

export function setMyPosition(pos) {
  appState.myPosition = pos;
  bus.emit('position:change', pos);
}

/** 确保天气数据可用（并发去重） */
export async function ensureWeather(force = false) {
  if (appState.weather && !force) return appState.weather;
  if (inflight && !force) return inflight;

  appState.weatherStatus = 'loading';
  bus.emit('weather:status', appState.weatherStatus);

  inflight = loadWeather({
    lat: appState.location.lat,
    lon: appState.location.lon,
    name: appState.location.name,
    force
  })
    .then((data) => {
      appState.weather = data;
      appState.weatherStatus = 'ready';
      appState.weatherError = '';
      bus.emit('weather:change', data);
      bus.emit('weather:status', 'ready');
      return data;
    })
    .catch((err) => {
      appState.weatherStatus = 'error';
      appState.weatherError = err.message || '天气加载失败';
      bus.emit('weather:status', 'error');
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** 初始化时读取上次的山峰 */
const savedMountain = prefsStore.get('mountainId');
if (savedMountain && MOUNTAINS.some((m) => m.id === savedMountain)) {
  appState.mountainId = savedMountain;
}

export { MOUNTAINS, CITIES };
