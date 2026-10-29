(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function n(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=n(s);fetch(s.href,i)}})();const dn="mossy-dawn",un=2,hn={trails:{keyPath:"id",indexes:[["startedAt","startedAt"]]},roadbooks:{keyPath:"id",indexes:[["createdAt","createdAt"]]},gear:{keyPath:"id",indexes:[["group","group"]]},contacts:{keyPath:"id",indexes:[]},pressure:{keyPath:"id",indexes:[["ts","ts"]]},cache:{keyPath:"key",indexes:[["expireAt","expireAt"]]},feedback:{keyPath:"id",indexes:[["mountainId","mountainId"],["ts","ts"]]}};let St=null;function Tt(){return St||(St=new Promise((e,t)=>{if(typeof indexedDB>"u"){t(new Error("当前环境不支持 IndexedDB"));return}const n=indexedDB.open(dn,un);n.onupgradeneeded=()=>{const a=n.result;for(const[s,i]of Object.entries(hn))if(!a.objectStoreNames.contains(s)){const o=a.createObjectStore(s,{keyPath:i.keyPath});for(const[r,c]of i.indexes)o.createIndex(r,c,{unique:!1})}},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)}),St)}async function kt(e,t,n){const a=await Tt();return new Promise((s,i)=>{const o=a.transaction(e,t),r=o.objectStore(e);let c;try{c=n(r)}catch(u){i(u);return}o.oncomplete=()=>s(c&&c.__req?c.__req.result:c),o.onerror=()=>i(o.error),o.onabort=()=>i(o.error)})}const at={async put(e,t){return await kt(e,"readwrite",n=>n.put(t)),t},async bulkPut(e,t){return await kt(e,"readwrite",n=>{t.forEach(a=>n.put(a))}),t},async get(e,t){const n=await Tt();return new Promise((a,s)=>{const i=n.transaction(e,"readonly").objectStore(e).get(t);i.onsuccess=()=>a(i.result||null),i.onerror=()=>s(i.error)})},async all(e){const t=await Tt();return new Promise((n,a)=>{const s=t.transaction(e,"readonly").objectStore(e).getAll();s.onsuccess=()=>n(s.result||[]),s.onerror=()=>a(s.error)})},async remove(e,t){await kt(e,"readwrite",n=>n.delete(t))},async clear(e){await kt(e,"readwrite",t=>t.clear())},async count(e){const t=await Tt();return new Promise((n,a)=>{const s=t.transaction(e,"readonly").objectStore(e).count();s.onsuccess=()=>n(s.result),s.onerror=()=>a(s.error)})}};async function ue(e){try{return await at.all(e)}catch(t){return console.warn("[db] 读取失败",e,t),[]}}async function Rt(e,t){try{return await at.put(e,t)}catch(n){return console.warn("[db] 写入失败",e,n),null}}const pn=Object.freeze(Object.defineProperty({__proto__:null,idb:at,safeAll:ue,safePut:Rt},Symbol.toStringTag,{value:"Module"})),mn={},zt=mn||{},Lt={qweather:{key:zt.VITE_QWEATHER_KEY||"",host:zt.VITE_QWEATHER_HOST||"https://devapi.qweather.com",geoHost:zt.VITE_QWEATHER_GEOHOST||"https://geoapi.qweather.com"},app:{version:"2.1.0",city:"深圳",location:{lat:22.5431,lon:114.0579,name:"深圳"}}},te="mossy.config";function Re(){try{return JSON.parse(localStorage.getItem(te)||"{}")}catch{return{}}}function wt(e,t){const n=Array.isArray(e)?[...e]:{...e};if(!t||typeof t!="object")return n;for(const[a,s]of Object.entries(t))s==null||s===""||(s&&typeof s=="object"&&!Array.isArray(s)?n[a]=wt(n[a]||{},s):n[a]=s);return n}let ht=wt(Lt,Re());const G={get all(){return ht},get(e,t){const n=e.split(".");let a=ht;for(const s of n){if(a==null)return t;a=a[s]}return a===void 0||a===""?t:a},set(e){const t=wt(Re(),e);return localStorage.setItem(te,JSON.stringify(t)),ht=wt(Lt,t),ht},reset(){localStorage.removeItem(te),ht=wt(Lt,{})},hasQWeather(){const e=ht.qweather.key;return!!e&&!/^YOUR_/.test(e)},weatherSource(){return this.hasQWeather()?"和风天气":"演示数据"}},ve=Lt.app.location,fn=(e="id")=>`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,gt=new Map,H={on(e,t){return gt.has(e)||gt.set(e,new Set),gt.get(e).add(t),()=>gt.get(e)?.delete(t)},emit(e,t){gt.get(e)?.forEach(n=>{try{n(t)}catch(a){console.warn("[bus]",e,a)}})}},Oe="mossy.prefs",ee={theme:"auto",voice:!0,notifications:!1,autoRefresh:!0,units:"metric",lastPage:"home",onboarded:!1,homeCity:"深圳"};let Z={...ee};try{Z={...ee,...JSON.parse(localStorage.getItem(Oe)||"{}")}}catch{Z={...ee}}const J={get all(){return{...Z}},get(e,t){return Z[e]===void 0?t:Z[e]},set(e){return Z={...Z,...e},localStorage.setItem(Oe,JSON.stringify(Z)),H.emit("prefs:change",Z),Z}},_t={async list(){return(await ue("trails")).sort((t,n)=>(n.startedAt||0)-(t.startedAt||0))},async save(e){const t={id:e.id||fn("trail"),name:e.name||"未命名轨迹",points:e.points||[],stats:e.stats||{},startedAt:e.startedAt||Date.now(),endedAt:e.endedAt||Date.now(),note:e.note||""};return await Rt("trails",t),H.emit("trail:change",t),t},async remove(e){await at.remove("trails",e).catch(()=>{}),H.emit("trail:change",null)},async get(e){return at.get("trails",e).catch(()=>null)}},qt={async get(e){const t=await at.get("cache",e).catch(()=>null);return!t||t.expireAt&&t.expireAt<Date.now()?null:t.value},async set(e,t,n=600){return await Rt("cache",{key:e,value:t,expireAt:Date.now()+n*1e3}),t},async clear(){await at.clear("cache").catch(()=>{})}};async function vn(){for(const e of["trails","roadbooks","gear","contacts","pressure","feedback","cache"])await at.clear(e).catch(()=>{});J.set({onboarded:!0})}const je=window.matchMedia("(prefers-color-scheme: dark)");let ot=J.get("theme","auto");function ze(e=ot){return e==="auto"?je.matches?"dark":"light":e}function Ft(){const e=ze();document.documentElement.setAttribute("data-theme",e),document.documentElement.style.colorScheme=e;const t=document.querySelector('meta[name="theme-color"]:not([media])');t&&t.setAttribute("content",e==="dark"?"#0c1411":"#f5f2ea"),H.emit("theme:change",{mode:ot,theme:e})}const et={init(){Ft(),je.addEventListener("change",()=>{ot==="auto"&&Ft()})},get mode(){return ot},get theme(){return ze()},set(e){ot=e,J.set({theme:e}),Ft()},cycle(){const e=["auto","light","dark"],t=e[(e.indexOf(ot)+1)%e.length];return this.set(t),t},label(e=ot){return{auto:"跟随系统",light:"浅色",dark:"深色"}[e]||"跟随系统"}},Bt={home:'<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',sunrise:'<path d="M12 2v6"/><path d="m8 6 4-4 4 4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',sunset:'<path d="M12 8V2"/><path d="m8 6 4 4 4-4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',moon:'<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',cloud:'<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 19Z"/>',cloudSun:'<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2"/><path d="M15 10a4 4 0 1 0-3.5 4"/><path d="M18 20a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 8 13.5 3.2 3.2 0 0 0 9 20Z"/>',cloudRain:'<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 19v2M12 18v3M16 19v2"/>',cloudSnow:'<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 18h.01M12 21h.01M16 18h.01M9 21h.01M15 21h.01"/>',cloudStorm:'<path d="M17.5 14a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 6.5 3.5 3.5 0 0 0 7 14Z"/><path d="m13 11-3 5h4l-2 5"/>',fog:'<path d="M4 9h16M3 13h18M5 17h14M7 21h10"/>',wind:'<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h8"/>',droplet:'<path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z"/>',gauge:'<path d="M12 14 8.5 9.5"/><circle cx="12" cy="14" r="1"/><path d="M4 18a9 9 0 1 1 16 0"/>',thermometer:'<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',navigation:'<path d="m3 11 19-8-8 19-2.5-7.5Z"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',route:'<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6"/>',mountain:'<path d="m2 20 7-14 4 8 2.5-4L22 20Z"/><path d="m9 6 1.5 3"/>',tent:'<path d="M4 21 12 4l8 17"/><path d="M8 21l4-8 4 8"/><path d="M2 21h20"/>',backpack:'<path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M9 4V3a3 3 0 0 1 6 0v1"/><path d="M9 12h6M9 16h6"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.1a4 4 0 0 1 0 7.75"/>',shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',alert:'<path d="m12 3 9 16a1 1 0 0 1-.9 1.5H3.9A1 1 0 0 1 3 19Z"/><path d="M12 9v4M12 17h.01"/>',bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M2 13h2M20 13h2"/>',sparkles:'<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9Z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',chevronRight:'<path d="m9 6 6 6-6 6"/>',chevronDown:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m4 12 5 5L20 6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/>',download:'<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',phone:'<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 12l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 7.2 2 2 0 0 1 6.5 3Z"/>',message:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/>',send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',play:'<path d="m7 4 13 8-13 8Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',square:'<rect x="6" y="6" width="12" height="12" rx="2"/>',crosshair:'<circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2"/>',zoomIn:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>',zoomOut:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',layers:'<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',wifiOff:'<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.2-2.1M19 12.9a10 10 0 0 0-2.4-1.7"/><path d="M2 8.8a15 15 0 0 1 5-2.6M22 8.8a15 15 0 0 0-6.4-2.7"/><path d="M12 20h.01"/>',battery:'<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 11v2M8 11v2"/>',lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',filter:'<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',star:'<path d="m12 3 2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.7l6.2-.8Z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',heart:'<path d="M12 20S3 14.5 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 14.5 12 20 12 20Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',spark:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',edit:'<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>',arrowDown:'<path d="M12 5v14M6 13l6 6 6-6"/>',minus:'<path d="M5 12h14"/>',grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',expand:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',footprint:'<path d="M6 16c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S6 17 6 16Z"/><path d="M15 13c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S15 14 15 13Z"/>'},gn={weather:"cloudSun",ai:"bot",gear:"backpack",teammate:"users",roadbook:"route",trail:"footprint",sos:"alert",pressure:"gauge",chase:"sunrise",home:"home",settings:"settings"};function x(e,t=18,n=""){const a=Bt[e]||Bt[gn[e]]||Bt.info;return`<svg class="${n}" xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${a}</svg>`}function qe(e=34){return`<svg width="${e}" height="${e}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bm-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5c946e"/><stop offset="0.55" stop-color="#33604a"/><stop offset="1" stop-color="#1b3427"/>
      </linearGradient>
      <linearGradient id="bm-s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe6ad"/><stop offset="1" stop-color="#e9a95e"/>
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="url(#bm-g)"/>
    <circle cx="27" cy="13" r="4.6" fill="url(#bm-s)" opacity="0.95"/>
    <path d="M4 31.5 13.5 17l5.2 8.2 3.3-4.6L36 31.5Z" fill="#0f2018" opacity="0.92"/>
    <path d="m8.5 31.5 5-8 3.2 5.2" stroke="#7fb894" stroke-width="1.1" stroke-linecap="round" opacity="0.6" fill="none"/>
  </svg>`}const yn=[{test:e=>e===100,kind:"sun",label:"晴"},{test:e=>e===150,kind:"moon",label:"晴"},{test:e=>e===151||e===152||e===153,kind:"cloud",label:"多云"},{test:e=>[101,102,103,151,152,153].includes(e),kind:"cloudSun",label:"多云"},{test:e=>e===104,kind:"cloud",label:"阴"},{test:e=>e>=200&&e<300,kind:"wind",label:"风"},{test:e=>e>=300&&e<400,kind:"cloudRain",label:"雨"},{test:e=>e>=400&&e<500,kind:"cloudSnow",label:"雪"},{test:e=>e>=500&&e<516,kind:"fog",label:"雾霾"},{test:e=>e>=302&&e<305,kind:"cloudStorm",label:"雷雨"}],bn={100:"晴",101:"多云",102:"少云",103:"晴间多云",104:"阴",150:"晴",153:"晴间多云",300:"阵雨",301:"强阵雨",302:"雷阵雨",303:"强雷阵雨",304:"雷阵雨伴冰雹",305:"小雨",306:"中雨",307:"大雨",308:"极端降雨",309:"毛毛雨",310:"暴雨",311:"大暴雨",312:"特大暴雨",313:"冻雨",314:"小到中雨",315:"中到大雨",316:"大到暴雨",317:"暴雨到大暴雨",318:"大暴雨到特大暴雨",399:"雨",400:"小雪",401:"中雪",402:"大雪",403:"暴雪",404:"雨夹雪",405:"雨雪天气",406:"阵雨夹雪",407:"阵雪",408:"小到中雪",409:"中到大雪",410:"大到暴雪",499:"雪",500:"薄雾",501:"雾",502:"霾",503:"扬沙",504:"浮尘",507:"沙尘暴",508:"强沙尘暴",509:"浓雾",510:"强浓雾",511:"中度霾",512:"重度霾",513:"严重霾",514:"大雾",515:"特强浓雾",900:"热",901:"冷",999:"未知"};function Ct(e,t=24){const n=Number(e),a=yn.find(s=>s.test(n));return x(a?a.kind:"cloud",t)}function wn(e){return bn[Number(e)]||"未知"}function L(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function _n(e,t,{duration:n=700,decimals:a=0,suffix:s=""}={}){if(!e)return;const i=0,o=performance.now(),r=c=>{const u=Math.min(1,(c-o)/n),p=1-Math.pow(1-u,3),f=i+(t-i)*p;e.textContent=f.toFixed(a)+s,u<1&&requestAnimationFrame(r)};requestAnimationFrame(r)}const rt=[];function Fe(e){document.body.style.overflow=e?"hidden":""}function Be(e,t){rt.push({layer:e,onClose:t}),Fe(!0)}function We(e){const t=rt.findIndex(n=>n.layer===e);t>=0&&rt.splice(t,1),rt.length||Fe(!1)}document.addEventListener("keydown",e=>{if(e.key!=="Escape"||!rt.length)return;rt[rt.length-1].layer.__close?.()});function Ot(e={}){const{title:t="",desc:n="",body:a="",actions:s=[],wide:i=!1,dismissible:o=!0,onMount:r}=e,c=document.activeElement,u=document.createElement("div");u.className="modal-layer",u.innerHTML=`
    <div class="modal ${i?"modal--wide":""}" role="dialog" aria-modal="true">
      ${t?`<h3 class="modal__title">${L(t)}</h3>`:""}
      ${n?`<p class="modal__desc">${n}</p>`:""}
      ${a?`<div class="modal__body">${a}</div>`:""}
      ${s.length?'<div class="modal__actions"></div>':""}
    </div>`;const p=u.querySelector(".modal"),f=u.querySelector(".modal__actions"),l=h=>{u.remove(),We(u),c?.focus?.({preventScroll:!0}),e.onClose?.(h)};return u.__close=()=>{o&&l()},s.forEach(h=>{const d=document.createElement("button");d.type="button",d.className=`btn ${h.variant?`btn--${h.variant}`:"btn--ghost"}`,d.textContent=h.label,d.addEventListener("click",async()=>{h.onClick&&await h.onClick({close:l,modal:p})===!1||h.close!==!1&&l(h.value)}),f?.appendChild(d)}),u.addEventListener("click",h=>{h.target===u&&o&&l()}),document.body.appendChild(u),Be(u,l),r?.(p,l),requestAnimationFrame(()=>{p.querySelector("input, textarea, select, button")?.focus?.({preventScroll:!0})}),{close:l,el:p}}function ne(e={}){const{title:t="确认操作",desc:n="",confirmText:a="确定",cancelText:s="取消",danger:i=!1,iconName:o=i?"alert":"info"}=e;return new Promise(r=>{let c=!1;const u=f=>{c||(c=!0,r(f))};Ot({title:t,body:n?`<p class="modal__desc" style="margin:0">${L(n)}</p>`:"",actions:[{label:s,variant:"ghost",onClick:()=>u(!1)},{label:a,variant:i?"danger":"primary",onClick:()=>u(!0)}],onClose:()=>u(!1)});const p=document.querySelector(".modal__title");p&&o&&p.insertAdjacentHTML("afterbegin",`<span style="color:var(--${i?"danger":"moss-500"});margin-right:6px;vertical-align:-2px;display:inline-block">${x(o,18)}</span>`)})}function he(e={}){const{title:t="",body:n="",onMount:a,dismissible:s=!0}=e,i=document.createElement("div");i.className="sheet-layer",i.innerHTML=`
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet__grip"></div>
      ${t?`<h3 class="sheet__title">${L(t)}</h3>`:""}
      <div class="sheet__body">${n}</div>
    </div>`;const o=i.querySelector(".sheet"),r=()=>{i.remove(),We(i)};return i.__close=()=>{s&&r()},i.addEventListener("click",c=>{c.target===i&&s&&r()}),document.body.appendChild(i),Be(i,r),a?.(o,r),{close:r,el:o}}function xn(e={}){const{title:t="",desc:n="",fields:a=[],submitText:s="保存",cancelText:i="取消",onSubmit:o}=e,r=`<div class="stack" style="gap:14px">${a.map(c=>`
    <label class="field">
      <span class="field__label">${L(c.label)}</span>
      ${c.type==="textarea"?`<textarea class="textarea" name="${c.name}" placeholder="${L(c.placeholder||"")}">${L(c.value||"")}</textarea>`:c.type==="select"?`<select class="select" name="${c.name}">${(c.options||[]).map(u=>`<option value="${L(u.value)}" ${u.value===c.value?"selected":""}>${L(u.label)}</option>`).join("")}</select>`:`<input class="input" name="${c.name}" type="${c.type||"text"}" value="${L(c.value||"")}" placeholder="${L(c.placeholder||"")}" ${c.required?"required":""} ${c.min!=null?`min="${c.min}"`:""} ${c.max!=null?`max="${c.max}"`:""} ${c.step?`step="${c.step}"`:""} />`}
      ${c.hint?`<span class="field__hint">${L(c.hint)}</span>`:""}
    </label>`).join("")}</div>`;return new Promise(c=>{let u=!1;const p=l=>{u||(u=!0,c(l))},{el:f}=Ot({title:t,desc:n,body:r,actions:[{label:i,variant:"ghost",onClick:()=>p(null)},{label:s,variant:"primary",onClick:()=>{const l={};let h=!0;if(a.forEach(d=>{const m=f.querySelector(`[name="${d.name}"]`);if(!m)return;const _=m.value.trim();d.required&&!_&&(h=!1,m.style.borderColor="var(--danger)"),l[d.name]=d.type==="number"?Number(_):_}),!h)return!1;o&&o(l),p(l)}}],onClose:()=>p(null)})})}let K=null;function $n(){return K&&document.body.contains(K)||(K=document.createElement("div"),K.className="toast-layer",K.setAttribute("role","status"),K.setAttribute("aria-live","polite"),document.body.appendChild(K)),K}const Mn={ok:"check",danger:"alert",warn:"alert",info:"info"};function pe(e,t={}){const{type:n="info",duration:a=2400}=t,s=$n(),i=document.createElement("div");i.className=`toast toast--${n}`,i.innerHTML=`${x(Mn[n]||"info",15)}<span>${L(e)}</span>`,s.appendChild(i);const o=()=>{i.classList.add("is-out"),setTimeout(()=>i.remove(),260)},r=setTimeout(o,a);return i.addEventListener("click",()=>{clearTimeout(r),o()}),o}const I=(e,t)=>pe(e,{...t,type:"ok"}),X=(e,t)=>pe(e,{...t,type:"warn"}),V=(e,t)=>pe(e,{...t,type:"danger"}),xt=new Map;let jt=null,ge=null,Wt=null,ye=null;function Sn(e){xt.set(e.id,e)}function be(){const e=(location.hash||"").replace(/^#\/?/,""),[t,...n]=e.split("?");return{id:t||"home",query:n.join("?")}}function kn(e){jt=e}function Tn(e){const t=document.createElement("section");return t.className="page",t.id=`page-${e.id}`,t.setAttribute("aria-label",e.title||e.id),t.innerHTML=e.template?e.template():"",jt.appendChild(t),e.el=t,e.mounted=!1,t}async function ae(e,{replace:t=!1}={}){const n=xt.get(e)||xt.get("home");if(!n||e===ge&&n.mounted)return;Wt?.(),Wt=null,[...jt.children].forEach(s=>s.classList.remove("is-active"));const a=n.el||Tn(n);if(a.classList.add("is-active"),document.title=`${n.title} · 晓山青`,n.mounted)n.onShow?.(a);else{try{Wt=await n.mount?.(a)||null}catch(s){console.error("[router] 页面挂载失败",e,s),a.innerHTML=`<div class="empty"><div class="empty__title">页面加载失败</div><div class="empty__desc">${s.message}</div></div>`}n.mounted=!0}ge=n.id,J.set({lastPage:n.id}),window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"}),H.emit("route:change",n.id),!t&&location.hash!==`#/${n.id}`&&history.replaceState(null,"",`#/${n.id}`)}function bt(e,t){xt.get(e)&&(location.hash===`#/${e}`?ae(e,t):location.hash=`#/${e}`)}function Cn(e,t="home"){jt=e,window.addEventListener("hashchange",()=>{const{id:a}=be();ae(a)});const{id:n}=be();return ye=ae(xt.has(n)?n:t),ye}const Pn=9e3;class pt extends Error{constructor(t,n){super(t),this.name="WeatherError",this.code=n}}function Ln(e,t,n){const a=new URL(e.replace(/\/$/,"")+t);return Object.entries(n).forEach(([s,i])=>{i!=null&&i!==""&&a.searchParams.set(s,i)}),a.toString()}async function Q(e,t,n){const a=G.get("qweather.key");if(!a)throw new pt("未配置和风天气 Key","NO_KEY");const s=new AbortController,i=setTimeout(()=>s.abort(),Pn);try{const o=await fetch(Ln(e,t,{...n,key:a}),{signal:s.signal,headers:{Accept:"application/json"}});if(!o.ok)throw new pt(`接口返回 ${o.status}`,`HTTP_${o.status}`);const r=await o.json();if(String(r.code)!=="200")throw new pt(`和风天气返回 ${r.code}`,String(r.code));return r}catch(o){throw o.name==="AbortError"?new pt("请求超时","TIMEOUT"):o instanceof pt?o:new pt(o.message||"网络错误","NETWORK")}finally{clearTimeout(i)}}const it=()=>G.get("qweather.host","https://devapi.qweather.com"),En=()=>G.get("qweather.geoHost","https://geoapi.qweather.com"),tt={now:(e,t)=>Q(it(),"/v7/weather/now",{location:`${e},${t}`,lang:"zh"}),hourly24:(e,t)=>Q(it(),"/v7/weather/24h",{location:`${e},${t}`,lang:"zh"}),daily7:(e,t)=>Q(it(),"/v7/weather/7d",{location:`${e},${t}`,lang:"zh"}),air:(e,t)=>Q(it(),"/v7/air/now",{location:`${e},${t}`,lang:"zh"}),warnings:(e,t)=>Q(it(),"/v7/warning/now",{location:`${e},${t}`,lang:"zh"}),indices:(e,t)=>Q(it(),"/v7/indices/1d",{location:`${e},${t}`,type:"0",lang:"zh"}),sun:(e,t,n)=>Q(it(),"/v7/astronomy/sun",{location:`${e},${t}`,date:n,lang:"zh"}),cityLookup:e=>Q(En(),"/v2/city/lookup",{location:e,number:8,lang:"zh"})},Et=Math.PI/180,Ue=180/Math.PI;function An(e){const t=new Date(e.getFullYear(),0,0);return Math.floor((e-t)/864e5)}function Ze(e){const t=An(e),n=e.getHours()+e.getMinutes()/60,a=2*Math.PI/365*(t-1+(n-12)/24),s=229.18*(75e-6+.001868*Math.cos(a)-.032077*Math.sin(a)-.014615*Math.cos(2*a)-.040849*Math.sin(2*a)),i=.006918-.399912*Math.cos(a)+.070257*Math.sin(a)-.006758*Math.cos(2*a)+907e-6*Math.sin(2*a)-.002697*Math.cos(3*a)+.00148*Math.sin(3*a);return{eqtime:s,decl:i}}function Ut(e,t){const n=new Date(e);return n.setHours(0,0,0,0),n.setMinutes(Math.round(t)),n}function st(e,t,n){const{eqtime:a,decl:s}=Ze(e),i=t*Et,o=90.833*Et,r=Math.cos(o)/(Math.cos(i)*Math.cos(s))-Math.tan(i)*Math.tan(s);if(r>1)return{polar:"night",sunrise:null,sunset:null};if(r<-1)return{polar:"day",sunrise:null,sunset:null};const c=Math.acos(r)*Ue,u=720-4*(n+c)-a,p=720-4*(n-c)-a,f=720-4*n-a,l=-e.getTimezoneOffset(),h=Ut(e,u+l),d=Ut(e,p+l),m=Ut(e,f+l);return{sunrise:h,sunset:d,solarNoon:m,dayLength:d-h,goldenHour:new Date(h.getTime()-25*6e4)}}function se(e,t){const{decl:n}=Ze(e),a=t*Et,s=-.833*Et,i=(Math.sin(n)-Math.sin(a)*Math.sin(s))/(Math.cos(a)*Math.cos(s));return Math.acos(Math.max(-1,Math.min(1,i)))*Ue}const Dn=[[22.5,"北"],[67.5,"东北"],[112.5,"东"],[157.5,"东南"],[202.5,"南"],[247.5,"西南"],[292.5,"西"],[337.5,"西北"],[360,"北"]];function Nn(e){const t=((Number(e)||0)%360+360)%360;for(const[n,a]of Dn)if(t<n)return a;return"北"}function Pt(e){const t=Nn(e);return t==="东"?"东侧山脊":`${t}向坡面`}function Ge(e=new Date){const t=29.530588853,n=Date.UTC(2e3,0,6,18,14);return((e.getTime()-n)/864e5%t+t)%t/t}function Ke(e){return e<.033||e>.967?"新月":e<.216?"娥眉月":e<.283?"上弦月":e<.466?"盈凸月":e<.534?"满月":e<.716?"亏凸月":e<.783?"下弦月":"残月"}function Ye(e){return(1-Math.cos(2*Math.PI*e))/2}function In(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t>>>0}function Hn(e){let t=e;return()=>{t|=0,t=t+1831565813|0;let n=Math.imul(t^t>>>15,1|t);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}const Rn=[{high:19,low:11},{high:20,low:12},{high:23,low:15},{high:26,low:19},{high:29,low:23},{high:31,low:25},{high:32,low:26},{high:32,low:26},{high:31,low:25},{high:28,low:22},{high:24,low:18},{high:21,low:13}],ie=[{code:100,text:"晴",weight:26,cloud:[0,12],pop:0,humid:[45,62],vis:[18,26]},{code:103,text:"晴间多云",weight:22,cloud:[25,55],pop:5,humid:[55,70],vis:[14,22]},{code:101,text:"多云",weight:20,cloud:[55,82],pop:12,humid:[62,78],vis:[12,18]},{code:104,text:"阴",weight:12,cloud:[82,98],pop:25,humid:[70,85],vis:[9,14]},{code:305,text:"小雨",weight:9,cloud:[85,100],pop:65,humid:[82,94],vis:[6,11]},{code:302,text:"雷阵雨",weight:6,cloud:[80,100],pop:78,humid:[78,92],vis:[5,10]},{code:500,text:"薄雾",weight:5,cloud:[40,70],pop:8,humid:[88,96],vis:[2,6]}],On=ie.reduce((e,t)=>e+t.weight,0);function jn(e){let t=e()*On;for(const n of ie)if(t-=n.weight,t<=0)return n;return ie[0]}const U=(e,[t,n])=>t+e()*(n-t),zn=e=>`${e.getFullYear()}${e.getMonth()+1}${e.getDate()}`;function Zt(e,t,n){const a=Hn(In(`day-${zn(e)}-${t.toFixed(2)}-${n.toFixed(2)}`)),s=jn(a),i=e.getMonth(),o=Rn[i],r=(a()-.5)*4,c=Math.round(o.high+r),u=Math.round(o.low+r*.6);return{r:a,pattern:s,high:c,low:u,climate:o}}function we(e,t,n){const a=(t+n)/2,s=(t-n)/2,i=(e-14+24)%24/24;return a+s*Math.cos(i*Math.PI*2)}const _e=["北风","东北风","东风","东南风","南风","西南风","西风","西北风"];function qn(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}function Fn(e,t,n="深圳"){const a=new Date,s=Zt(a,e,t),{r:i,pattern:o,high:r,low:c}=s,u=Math.round(we(a.getHours()+a.getMinutes()/60,r,c)),p=Math.round(U(i,o.humid)),f=Math.round(U(i,[1,o.pop>50?5:4])),l=Math.floor(i()*8),h=Math.round(U(i,o.cloud)),d=Math.round(U(i,o.vis)),m=Math.round(1009+(i()-.5)*12+(o.pop>50?-4:2)),_=Math.round(u+(p>75?2.4:p<50?-1.2:.6)),y=st(a,e,t),k=Ge(a),P=[];for(let M=0;M<24;M++){const w=new Date(a.getTime()+M*36e5);w.setMinutes(0,0,0);const $=Zt(w,e,t),C=w.getHours(),F=y.sunrise&&(w<y.sunrise||w>y.sunset)&&$.pattern.code===100?150:$.pattern.code;P.push({time:w,temp:Math.round(we(C,$.high,$.low)),code:F,text:$.pattern.text,pop:Math.min(100,Math.round($.pattern.pop+(i()-.5)*18)),windScale:Math.round(U(i,[1,4])),humidity:Math.round(U(i,$.pattern.humid))})}const T=[];for(let M=0;M<7;M++){const w=new Date(a.getFullYear(),a.getMonth(),a.getDate()+M),$=Zt(w,e,t),C=st(w,e,t),N=$.pattern.code===100?150:$.pattern.code;T.push({date:qn(w),dateObj:w,max:$.high,min:$.low,tempNight:$.low,codeDay:$.pattern.code,textDay:$.pattern.text,codeNight:N,textNight:$.pattern.text,pop:$.pattern.pop,precip:$.pattern.pop>50?(Math.round($.r()*12*10)/10).toFixed(1):"0.0",humidity:Math.round(U($.r,$.pattern.humid)),windDir:_e[Math.floor($.r()*8)],windScale:`${Math.round(U($.r,[1,4]))}-${Math.round(U($.r,[2,5]))}`,uv:Math.max(0,Math.round(($.pattern.cloud[0]<40?8:4)+($.r()-.5)*4)),cloud:Math.round(U($.r,$.pattern.cloud)),vis:Math.round(U($.r,$.pattern.vis)),sunrise:C.sunrise?`${String(C.sunrise.getHours()).padStart(2,"0")}:${String(C.sunrise.getMinutes()).padStart(2,"0")}`:"--:--",sunset:C.sunset?`${String(C.sunset.getHours()).padStart(2,"0")}:${String(C.sunset.getMinutes()).padStart(2,"0")}`:"--:--"})}const v=Math.round(Math.max(18,Math.min(120,32+(100-d*4)+(i()-.5)*30))),b=v<=50?"优":v<=100?"良":"轻度污染",S=[];o.pop>=65&&S.push({id:"demo-warn-1",title:`深圳市气象台发布${o.text==="雷阵雨"?"雷电":"暴雨"}黄色预警`,type:"1006",typeName:o.text==="雷阵雨"?"雷电":"暴雨",level:"黄色",severity:"Moderate",severityColor:"Yellow",pubTime:new Date(a.getTime()-2*36e5).toISOString(),startTime:new Date(a.getTime()-2*36e5).toISOString(),endTime:new Date(a.getTime()+8*36e5).toISOString(),sender:"深圳市气象台",text:`预计未来 6 小时内本地将出现${o.text==="雷阵雨"?"雷雨":"较强降水"}，并伴有短时大风，请注意防范。山区徒步请推迟行程。`});const g=[{type:"1",name:"运动指数",category:o.pop>50?"不宜":u>32?"较不宜":"适宜",text:o.pop>50?"有降水，建议改为室内运动。":"天气较好，适合户外徒步，注意补水。"},{type:"2",name:"穿衣指数",category:u>28?"炎热":u>22?"舒适":u>16?"较凉":"冷",text:u>28?"建议短袖速干衣裤。":u>22?"长袖速干衣加薄外套。":"建议加抓绒与防风层。"},{type:"3",name:"紫外线",category:h<40?"强":"中等",text:h<40?"山顶紫外线强，务必防晒。":"紫外线适中，仍需基础防晒。"},{type:"5",name:"洗车指数",category:o.pop>50?"不宜":"适宜",text:o.pop>50?"有降水，不建议洗车。":"天气较好，适合洗车。"},{type:"6",name:"旅游指数",category:o.pop>50?"一般":"适宜",text:o.pop>50?"降水影响出行体验。":"适合出行，注意山区天气变化。"},{type:"9",name:"过敏指数",category:p>80?"易发":"不易发",text:p>80?"湿度大，霉菌花粉易扩散。":"过敏风险较低。"}];return{source:"demo",updatedAt:Date.now(),place:{name:n,lat:e,lon:t},now:{temp:u,feels:_,text:o.text,code:o.code,humidity:p,windDir:_e[l],windScale:String(f),windSpeed:String(Math.round(f*4+i()*3)),pressure:String(m),vis:String(d),cloud:String(h),dew:String(Math.round(u-(100-p)/5)),precip:o.pop>50?(i()*2).toFixed(1):"0.0"},hourly:P,daily:T,air:{aqi:v,category:b,level:String(v<=50?1:2),primary:"PM2.5",pm2p5:String(Math.round(v*.6)),pm10:String(Math.round(v*.85))},warnings:S,indices:g,sun:{sunrise:y.sunrise,sunset:y.sunset,solarNoon:y.solarNoon,dayLength:y.dayLength},moon:{phase:k,phaseName:Ke(k),illumination:Ye(k)}}}function Bn(e,t){const n=Math.max(1,Math.min(100,Number(t)||60)),a=Math.log(n/100)+17.62*e/(243.12+e);return 243.12*a/(17.62-a)}function Ve(e,t){return Math.max(0,e-Bn(e,t))}function Wn(e,t){return 125*Ve(e,t)}function Un(e,t,n=30){return n+Wn(e,t)}function Zn({dtr:e,cloudNight:t,windScale:n}){const a=E((e-4)/9),s=E((70-t)/50),i=E((5-n)/4);return E(.45*a+.3*s+.25*i)}function Xe({precip:e,text:t="",code:n=0}){const a=Number(e)||0;if(a>=10)return 95;if(a>=3)return 82;if(a>=.5)return 65;const s=Number(n)||0;return s>=300&&s<=399?70:s>=400&&s<=499?60:/雨|雪|雷/.test(t)?55:/阴/.test(t)?28:/多云|晴间/.test(t)?12:4}function Gn(e){const n=String(e??"").match(/\d+(\.\d+)?/g);if(!n||!n.length)return 3;const a=n.map(Number);return a.length>1?(a[0]+a[1])/2:a[0]}const E=e=>{const t=Number(e);return Number.isFinite(t)?Math.max(0,Math.min(1,t)):0},$t=(e,t,n)=>Math.max(t,Math.min(n,Number(e)||0)),Kn=e=>1/(1+Math.exp(-$t(e,-20,20))),oe=e=>{const t=$t(e,.01,.99);return Math.log(t/(1-t))},Yn=600,z=(e,t=0)=>{const n=Number(e);return Number.isFinite(n)?Number(n.toFixed(t)):0};function Vn(e,t,n,a){const{now:s,hourly:i,daily:o,air:r,warnings:c,indices:u}=a,p=st(new Date,e,t),f=Ge();return{source:"live",updatedAt:Date.now(),place:{name:n,lat:e,lon:t},now:{temp:z(s.temp),feels:z(s.feelsLike),text:s.text||wn(s.icon),code:Number(s.icon),humidity:z(s.humidity),windDir:s.windDir||"--",windScale:String(s.windScale??"--"),windSpeed:String(s.windSpeed??"--"),pressure:String(s.pressure??"--"),vis:String(s.vis??"--"),cloud:String(s.cloud??"--"),dew:String(s.dew??"--"),precip:String(s.precip??"0.0")},hourly:(i?.hourly||[]).slice(0,24).map(l=>({time:new Date(l.fxTime),temp:z(l.temp),code:Number(l.icon),text:l.text,pop:z(l.pop),windScale:Number(l.windScale),humidity:z(l.humidity)})),daily:(o?.daily||[]).map(l=>({date:l.fxDate,dateObj:new Date(`${l.fxDate}T12:00:00`),max:z(l.tempMax),min:z(l.tempMin),tempNight:z(l.tempMin),codeDay:Number(l.iconDay),textDay:l.textDay,codeNight:Number(l.iconNight),textNight:l.textNight,pop:Xe({precip:l.precip,text:l.textDay,code:l.iconDay}),precip:String(l.precip??"0.0"),humidity:z(l.humidity),windDir:l.windDirDay,windScale:l.windScaleDay,uv:z(l.uvIndex),cloud:z(l.cloud),vis:z(l.vis),sunrise:l.sunrise,sunset:l.sunset,moonPhase:l.moonPhase})),air:r?{aqi:z(r.now?.aqi),category:r.now?.category||"--",level:String(r.now?.level||"1"),primary:r.now?.primary||"--",pm2p5:String(r.now?.pm2p5??"--"),pm10:String(r.now?.pm10??"--")}:null,warnings:(c?.warning||[]).map(l=>({id:l.id,title:l.title,type:l.type,typeName:l.typeName,level:l.level,severity:l.severity,severityColor:l.severityColor,pubTime:l.pubTime,startTime:l.startTime,endTime:l.endTime,sender:l.sender,text:l.text})),indices:(u?.daily||[]).map(l=>({type:l.type,name:l.name,category:l.category,text:l.text})),sun:{sunrise:p.sunrise,sunset:p.sunset,solarNoon:p.solarNoon,dayLength:p.dayLength},moon:{phase:f,phaseName:Ke(f),illumination:Ye(f)}}}async function Je({lat:e,lon:t,name:n="当前位置",force:a=!1}={}){const s=`wx:${e.toFixed(3)}:${t.toFixed(3)}`;if(!a){const o=await qt.get(s);if(o)return o}if(G.hasQWeather())try{const[o,r,c,u,p,f]=await Promise.allSettled([tt.now(t,e),tt.hourly24(t,e),tt.daily7(t,e),tt.air(t,e),tt.warnings(t,e),tt.indices(t,e)]);if(o.status==="fulfilled"){const l=Vn(e,t,n,{now:o.value.now,hourly:r.status==="fulfilled"?r.value:null,daily:c.status==="fulfilled"?c.value:null,air:u.status==="fulfilled"?u.value:null,warnings:p.status==="fulfilled"?p.value:null,indices:f.status==="fulfilled"?f.value:null});return await qt.set(s,l,Yn),l}console.warn("[weather] 实时数据获取失败，回退演示数据",o.reason)}catch(o){console.warn("[weather] 请求异常，回退演示数据",o)}const i=Fn(e,t,n);return await qt.set(s,i,180),i}async function Xn(e){const t=e.trim();if(!t)return[];if(G.hasQWeather())try{const n=await tt.cityLookup(t);if(n?.location?.length)return n.location.map(a=>({name:a.name,lat:Number(a.lat),lon:Number(a.lon),admin:[a.adm1,a.adm2].filter(Boolean).join(" · ")}))}catch(n){console.warn("[weather] 城市搜索失败",n)}return[]}const dt=[{id:"wutong",name:"梧桐山",elevation:943,lat:22.581,lon:114.219,area:"罗湖 / 盐田",season:"10 月 — 次年 3 月",desc:"深圳第一峰，主峰大梧桐。云海与日出最经典，秋冬清晨湿度大时云海概率高。",tags:["云海","日出","深圳十峰"],difficulty:3,route:{distance:11.2,ascent:820,hours:5.5}},{id:"qiniang",name:"七娘山",elevation:869,lat:22.548,lon:114.561,area:"大鹏新区",season:"11 月 — 次年 4 月",desc:"深圳第二峰，三面环海，山脊视野极佳。坡度陡、以碎石路为主。",tags:["海景","日出","强度高"],difficulty:4,route:{distance:9.6,ascent:760,hours:6}},{id:"maluan",name:"马峦山",elevation:590,lat:22.629,lon:114.33,area:"坪山新区",season:"四季皆宜",desc:"瀑布群与百年梅花，路径成熟，适合轻装徒步和亲子出行。",tags:["瀑布","亲子","新手友好"],difficulty:2,route:{distance:8.4,ascent:420,hours:3.5}},{id:"paiya",name:"排牙山",elevation:707,lat:22.593,lon:114.487,area:"大鹏新区",season:"11 月 — 次年 3 月",desc:"锯齿状山脊，两侧临海，被称为深圳最险的穿越线路，需要手脚并用。",tags:["山脊","挑战","海景"],difficulty:5,route:{distance:12.8,ascent:880,hours:7}},{id:"meishajian",name:"梅沙尖",elevation:753,lat:22.607,lon:114.36,area:"盐田区",season:"10 月 — 次年 4 月",desc:"深圳第三高峰，山顶可俯瞰大小梅沙与盐田港，日出方向正对海平面。",tags:["日出","海景","深圳十峰"],difficulty:3,route:{distance:7.8,ascent:640,hours:4}},{id:"tanglang",name:"塘朗山",elevation:430,lat:22.586,lon:113.993,area:"南山区",season:"四季皆宜",desc:"城市绿肺，登山道完善，傍晚可看落日与城市灯光，通勤后夜爬首选。",tags:["城市","夜爬","新手友好"],difficulty:2,route:{distance:5.6,ascent:330,hours:2.5}},{id:"fenghuang",name:"凤凰山",elevation:376,lat:22.686,lon:113.846,area:"宝安区",season:"四季皆宜",desc:"古村、寺庙与森林并存，石阶路为主，适合半天轻徒步。",tags:["人文","轻徒步","新手友好"],difficulty:1,route:{distance:4.2,ascent:260,hours:2}},{id:"yangtaishan",name:"阳台山",elevation:587,lat:22.632,lon:113.988,area:"龙华 / 宝安",season:"10 月 — 次年 5 月",desc:"溪谷与瀑布众多，雨季水量充沛，注意湿滑与蚊虫。",tags:["溪谷","瀑布","避暑"],difficulty:2,route:{distance:7.1,ascent:480,hours:3.5}},{id:"dananshan",name:"大南山",elevation:336,lat:22.491,lon:113.913,area:"南山区",season:"四季皆宜",desc:"山顶可同时看到前海与蛇口港，日落与城市天际线是最大看点。",tags:["日落","城市","轻徒步"],difficulty:1,route:{distance:3.8,ascent:220,hours:1.8}},{id:"luofu",name:"罗浮山",elevation:1296,lat:23.268,lon:114.056,area:"惠州 · 博罗",season:"11 月 — 次年 4 月",desc:"岭南第一山，飞云顶云海概率高，适合两日重装或一日强穿。",tags:["云海","重装","外线"],difficulty:4,route:{distance:16.5,ascent:1100,hours:8}},{id:"nankun",name:"南昆山",elevation:1228,lat:23.635,lon:113.86,area:"惠州 · 龙门",season:"四季皆宜",desc:"北回归线上的森林氧吧，夏季避暑、秋季观星，车程约 2 小时。",tags:["森林","避暑","观星"],difficulty:3,route:{distance:10.2,ascent:700,hours:5}},{id:"yinhu",name:"银湖山",elevation:445,lat:22.586,lon:114.103,area:"罗湖 / 福田",season:"四季皆宜",desc:"市区内少见的连片山脊绿道，适合晨跑与短距越野训练。",tags:["越野跑","绿道","城市"],difficulty:2,route:{distance:6.4,ascent:380,hours:2.5}}],Jn=e=>dt.find(t=>t.id===e)||dt[0],ct=[{name:"深圳",lat:22.5431,lon:114.0579,group:"深圳"},{name:"福田区",lat:22.541,lon:114.055,group:"深圳"},{name:"罗湖区",lat:22.548,lon:114.131,group:"深圳"},{name:"南山区",lat:22.533,lon:113.93,group:"深圳"},{name:"盐田区",lat:22.557,lon:114.237,group:"深圳"},{name:"宝安区",lat:22.555,lon:113.883,group:"深圳"},{name:"龙岗区",lat:22.72,lon:114.246,group:"深圳"},{name:"龙华区",lat:22.696,lon:114.045,group:"深圳"},{name:"坪山区",lat:22.69,lon:114.346,group:"深圳"},{name:"光明区",lat:22.748,lon:113.936,group:"深圳"},{name:"大鹏新区",lat:22.596,lon:114.479,group:"深圳"},{name:"广州",lat:23.1291,lon:113.2644,group:"周边"},{name:"惠州",lat:23.1115,lon:114.4162,group:"周边"},{name:"东莞",lat:23.0207,lon:113.7518,group:"周边"},{name:"珠海",lat:22.2707,lon:113.5767,group:"周边"}],Gt=ct.find(e=>e.name===J.get("homeCity","深圳"))||ct[0],A={location:{name:Gt.name,lat:Gt.lat??ve.lat,lon:Gt.lon??ve.lon},weather:null,weatherStatus:"idle",weatherError:"",mountainId:dt[0].id};let yt=null;function D(){return Jn(A.mountainId)}function re(e){A.mountainId=e,J.set({mountainId:e}),H.emit("mountain:change",e)}function xe({name:e,lat:t,lon:n}){A.location={name:e,lat:t,lon:n},J.set({homeCity:e}),A.weather=null,H.emit("location:change",A.location)}async function lt(e=!1){return A.weather&&!e?A.weather:(yt&&!e||(A.weatherStatus="loading",H.emit("weather:status",A.weatherStatus),yt=Je({lat:A.location.lat,lon:A.location.lon,name:A.location.name,force:e}).then(t=>(A.weather=t,A.weatherStatus="ready",A.weatherError="",H.emit("weather:change",t),H.emit("weather:status","ready"),t)).catch(t=>{throw A.weatherStatus="error",A.weatherError=t.message||"天气加载失败",H.emit("weather:status","error"),t}).finally(()=>{yt=null})),yt)}const Kt=J.get("mountainId");Kt&&dt.some(e=>e.id===Kt)&&(A.mountainId=Kt);const Qn=[{id:"home",name:"首页",icon:"home",desc:"今天值不值得上山"},{id:"chase",name:"追光",icon:"sunrise",desc:"日出 · 云海 · 星空概率"},{id:"trail",name:"轨迹",icon:"footprint",desc:"GPS 记录与光之卡片"},{id:"weather",name:"天气",icon:"cloudSun",desc:"实时与七日预报"},{id:"settings",name:"设置",icon:"settings",desc:"数据源与偏好"}],$e=Qn.filter(e=>e.id!=="settings"),ta=e=>`<button class="topnav__item" type="button" data-nav="${e.id}">
    ${x(e.icon,16)}<span>${e.name}</span>
  </button>`,ea=e=>`<button class="tabbar__item" type="button" data-nav="${e.id}">
    ${x(e.icon,21)}<span>${e.name}</span>
  </button>`;function na(){const e=A.weather?.source;return e==="live"?{text:"实时数据",tone:"live"}:e==="demo"?{text:"演示数据",tone:"demo"}:{text:navigator.onLine?"在线":"离线",tone:"idle"}}function aa(e){e.innerHTML=`
    <header class="topbar" id="topbar">
      <div class="topbar__inner">
        <button class="brand" type="button" data-nav="home" aria-label="返回首页">
          <span class="brand__mark">${qe(34)}</span>
          <span class="brand__text">
            <span class="brand__name">晓山青</span>
            <span class="brand__sub">Viridiore</span>
          </span>
        </button>

        <nav class="topnav" aria-label="主导航">
          ${$e.map(ta).join("")}
        </nav>

        <div class="topbar__actions">
          <span class="net-pill" id="netPill" title="数据来源">离线</span>
          <button class="icon-btn" type="button" id="themeBtn" title="切换主题" aria-label="切换主题">
            ${x("moon",19)}
          </button>
          <button class="icon-btn" type="button" data-nav="settings" title="设置" aria-label="设置">
            ${x("settings",19)}
          </button>
        </div>
      </div>
    </header>

    <main class="main" id="page-root"></main>

    <nav class="tabbar" aria-label="底部导航">
      ${$e.map(ea).join("")}
    </nav>
  `;const t=e.querySelector("#topbar"),n=e.querySelector("#netPill"),a=e.querySelector("#themeBtn"),s=e.querySelector("#page-root");e.addEventListener("click",c=>{const u=c.target.closest("[data-nav]");u&&bt(u.dataset.nav)}),a.addEventListener("click",()=>{const c=et.cycle(),u={auto:"跟随系统",light:"浅色模式",dark:"深色模式"}[c];I(`已切换为${u}`),i()});function i(){const c=et.mode,u=c==="auto"?"sparkles":c==="dark"?"moon":"sun";a.innerHTML=x(u,19),a.title=`主题：${et.label()}`}function o(){const{text:c,tone:u}=na();n.textContent=c,n.classList.toggle("is-offline",!navigator.onLine),n.classList.toggle("is-demo",u==="demo")}window.addEventListener("online",o),window.addEventListener("offline",o),H.on("weather:change",o);const r=()=>t.classList.toggle("is-stuck",window.scrollY>4);return window.addEventListener("scroll",r,{passive:!0}),H.on("route:change",c=>{e.querySelectorAll("[data-nav]").forEach(u=>{u.classList.toggle("is-active",u.dataset.nav===c)})}),document.documentElement.addEventListener("theme:change",i),o(),i(),r(),{pageRoot:s}}const Y=e=>String(e).padStart(2,"0"),Qe=["周日","周一","周二","周三","周四","周五","周六"];function vt(e,t=!1){const n=new Date(e),a=`${n.getMonth()+1}月${n.getDate()}日`;return t?`${a} ${Qe[n.getDay()]}`:a}function q(e,t=!1){const n=new Date(e);return t?`${Y(n.getHours())}:${Y(n.getMinutes())}:${Y(n.getSeconds())}`:`${Y(n.getHours())}:${Y(n.getMinutes())}`}function sa(e){const t=Date.now()-e;return t<6e4?"刚刚":t<36e5?`${Math.floor(t/6e4)} 分钟前`:t<864e5?`${Math.floor(t/36e5)} 小时前`:t<7*864e5?`${Math.floor(t/864e5)} 天前`:vt(e)}function ia(e){const t=Math.max(0,Math.floor(e/1e3)),n=Math.floor(t/3600),a=Math.floor(t%3600/60),s=t%60;return n>0?`${n}:${Y(a)}:${Y(s)}`:`${Y(a)}:${Y(s)}`}function oa(e){const t=Math.round(e/6e4);if(t<60)return`${t} 分钟`;const n=Math.floor(t/60),a=t%60;return a?`${n} 小时 ${a} 分`:`${n} 小时`}function ce(e){return Number.isFinite(e)?e<1e3?`${Math.round(e)} m`:`${(e/1e3).toFixed(2)} km`:"0 m"}const ra=25,ca=30,la=[.18,.2,.16,.1,.06,.03,.02,.02,.04,.09,.16,.19],da=[.52,.46,.4,.32,.26,.2,.22,.22,.28,.4,.48,.52],ua=[.42,.36,.28,.2,.14,.1,.12,.12,.18,.3,.38,.42],W={cloudsea:{key:"cloudsea",name:"云海",icon:"cloud",desc:"在云上等太阳",prior:la,windowLabel:"日出前后 40 分钟"},sunrise:{key:"sunrise",name:"日出",icon:"sunrise",desc:"为了一抹晨光",prior:da,windowLabel:"日出前 30 分钟 — 日出后 20 分钟"},stars:{key:"stars",name:"星空",icon:"star",desc:"银河与星轨",prior:ua,windowLabel:"天黑后 — 月出前"}};function ha(e){const t=Number(e.min??e.tempNight??18),n=Number(e.humidity??70),a=Ve(t,n),s=Un(t,n,ca),i=E((n-68)/30),o=220+620*i;return{nightTemp:t,rh:n,spread:a,base:s,thickness:o,top:s+o,moist:i,dewPoint:t-a}}function Me(e,t="cloudsea",n={}){const a=W[t]||W.cloudsea,s=n.mountain||{elevation:600},i=Number(s.elevation)||600,o=ha(e),r=Number(e.cloud??50),c=Number(e.precip)||0,u=Number.isFinite(Number(e.pop))?Number(e.pop):Xe(e),p=Number(e.vis??12),f=Gn(e.windScale),l=Math.max(0,Number(e.max??0)-Number(e.min??0)),h=Zn({dtr:l,cloudNight:r,windScale:f}),d=[],m=(g,M,w,$,C)=>{!Number.isFinite($)||Math.abs($)<.06||d.push({key:g,label:M,value:w,delta:$,detail:C,tone:$>0?"pro":"con"})};let _=n.cloudseaProb;if(t==="cloudsea"){const g=i-o.top,M=E(g/200),w=E((o.top-i)/350),$=E((o.top-ra)/300);m("cloudbase","云层位置",`云顶约 ${Math.round(o.top)} m`,2.3*M*$-2*w,g>=0?`云顶在山顶以下约 ${Math.round(g)} m，你站的位置在云上`:`云顶高出山顶约 ${Math.round(-g)} m，很可能身在雾中`),m("clouddepth","云层厚度",`${Math.round(o.thickness)} m`,.8*($-.4),$>.6?'云层有足够厚度，能成"海"':"云层太薄，形不成规模"),m("moisture","近地水汽",`${Math.round(o.rh)}%`,1.1*E((o.rh-78)/18),`露点 ${o.dewPoint.toFixed(1)} ℃，温度露点差 ${o.spread.toFixed(1)} ℃`),m("inversion","逆温估算",`${Math.round(h*100)}%`,1.1*(h-.35),"由昼夜温差、夜间云量、风力合成，非探空实测"),m("wind","风力",`${f} 级`,-.35*Math.max(0,f-3),f>=4?"风偏大，逆温层容易被搅散":"风力温和，有利于层结稳定"),m("precip","降水",`${c} mm`,-1.5*E(c/8)-.6*E((u-55)/45),c>0?"当天有降水，云层结构不稳定":"无明显降水"),m("elevation","海拔",`${i} m`,.5*E((i-400)/800),i>=850?"海拔够高，更容易穿出云层":"海拔偏低，云顶经常与山顶齐平"),m("vis","能见度",`${p} km`,.25*E((p-8)/15)-.3*E((6-p)/6),p<5?"能见度低，可能是就地起雾而非云海":"能见度正常")}if(t==="sunrise"){const g=E((o.top-i)/300),M=E((r-58)/40),w=1-E(Math.abs(r-38)/42);m("cloudcover","总云量",`${r}%`,-1.3*M+.75*w-.15,r>85?"云层过厚，太阳大概率被挡":r<12?"天空太干净，缺少出霞的层次":"云量适中，霞光层次好"),m("cloudtop","是否在云上",`${Math.round(o.top)} m`,-1.1*g,g>.5?"云顶高过山顶，可能在雾里等天亮":"山顶在云层之上，视野通透"),m("precip","降水",`${c} mm / ${Math.round(u)}%`,-1.5*E(c/6)-.7*E((u-40)/60),c>0?"有降水，日出段可能被雨云遮挡":"无降水干扰"),m("vis","能见度",`${p} km`,.6*E((p-8)/15)-.4*E((7-p)/7),p<6?"能见度差，远景发灰":"能见度可支撑远景"),m("wind","风力",`${f} 级`,-.4*E((f-4)/4),f>=6?"山顶风大，注意保暖与站稳":"风力可接受"),Number.isFinite(_)&&_>=55&&m("seabonus","云海叠加",`${_}%`,.7,"云海概率较高，日出会打在云面上")}if(t==="stars"){m("cloud","总云量",`${r}%`,-2*E((r-10)/55),r>60?"云量偏多，银河基本看不到":"天空较为通透"),m("precip","降水",`${c} mm`,-1.6*E(c/5)-.5*E((u-30)/70),c>0?"有降水，不适合观星":"无降水"),m("humidity","水汽",`${Math.round(o.rh)}%`,-.9*E((o.rh-68)/26),o.rh>85?"水汽重，星光被散射变暗":"空气干爽，星点清晰");const g=E(n.moonIllum??0);m("moon","月光干扰",`${Math.round(g*100)}%`,-.6*g,g>.6?"接近满月，暗弱天体被压制":"月光干扰小"),m("vis","能见度",`${p} km`,.5*E((p-12)/16),p<10?"能见度一般，地平附近星点稀少":"通透度好"),m("wind","风力",`${f} 级`,-.3*E((f-3)/4),f>=5?"风大，长曝光会抖":"风力平稳")}const y=d.reduce((g,M)=>g+M.delta,0),k=(e.dateObj instanceof Date?e.dateObj:new Date).getMonth(),P=a.prior[k]??.15,T=Number(n.calibration?.offset)||0;let v=Kn(oe(P)+y+T);v=$t(v,.02,.96);const b=Math.round(v*100),S=[...d].sort((g,M)=>Math.abs(M.delta)-Math.abs(g.delta));return{probability:b,baseRate:Math.round(P*100),grade:pa(b),factors:S,pros:S.filter(g=>g.tone==="pro").slice(0,3),cons:S.filter(g=>g.tone==="con").slice(0,3),confidence:fa(n),calibration:n.calibration||{offset:0,n:0},geometry:o,verdict:ma(b),mode:t}}function pa(e){return e>=72?{label:"值得去",tone:"great"}:e>=55?{label:"可以赌",tone:"good"}:e>=38?{label:"看运气",tone:"fair"}:e>=22?{label:"别抱期待",tone:"poor"}:{label:"建议改期",tone:"bad"}}function ma(e){return e>=72?"大概率能看到":e>=55?"有一半以上把握":e>=38?"要看运气":e>=22?"机会不大":"不值得专程跑一趟"}function fa(e={}){const t=Number(e.dayIndex)||0;let n=.88-t*.065;e.source==="demo"&&(n=Math.min(n,.4));const a=Number(e.calibration?.n)||0;n+=Math.min(.1,a*.012),n=$t(n,.15,.95);const s=n>=.72?"高":n>=.5?"中":"低",i=e.source==="demo"?"当前是演示数据，概率只用于展示模型行为":t>=4?"预报时效较远，临出发前一天请再看一次":a<3?"本地样本不足，尚未校准":"已结合你的历史反馈校正";return{score:Math.round(n*100),label:s,hint:i}}function At(e=[],t="cloudsea",n={}){if(!e.length)return{all:[],ranked:[],best:null};const a=e.map((o,r)=>Me(o,"cloudsea",{...n,dayIndex:r,cloudseaProb:void 0}).probability),s=e.map((o,r)=>Object.assign(Me(o,t,{...n,dayIndex:r,cloudseaProb:a[r]}),{day:o,index:r})),i=[...s].sort((o,r)=>r.probability-o.probability);return{all:s,ranked:i,best:i[0]||null}}const Yt=e=>e?`${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`:"--:--",Dt=e=>{const t=e.dateObj instanceof Date?e.dateObj:new Date(e.date);return`${t.getMonth()+1} 月 ${t.getDate()} 日`};function Se(e,t){if(e===0)return"今天";if(e===1)return"明天";if(e===2)return"后天";const n=t?.dateObj instanceof Date?t.dateObj:new Date(t?.date||Date.now());return["周日","周一","周二","周三","周四","周五","周六"][n.getDay()]||Dt(t||{})}function Nt(e,t){const n=(Number(e.max)+Number(e.min))/2;return Number.isFinite(n)?Math.round(n-(t-30)/100*.6):null}function tn(e,t="cloudsea",n={}){if(!e)return"暂无预报数据。";const a=e.day,s=a.dateObj instanceof Date?a.dateObj:new Date(a.date),i=n.lat??22.58,o=n.lon??114.2,r=st(s,i,o),c=se(s,i),u=Pt(c),p=n.name||"山顶",f=Nt(a,n.elevation||600);if(t==="stars"){const d=Math.round((e.moonIllum??0)*100);return`${Dt(a)} 天黑后，${p}看到星空概率 ${e.probability}%（月光亮度 ${d}%）。山顶气温约 ${f} ℃，比市区低 4—6 ℃，记得带保暖层和头灯。`}const l=Yt(r.sunrise),h=e.probability>=72?`值得为它早起。建议 ${Yt(new Date(r.sunrise.getTime()-90*6e4))} 前从山脚出发`:e.probability>=55?`可以去，但留个 B 计划。${Yt(new Date(r.sunrise.getTime()-90*6e4))} 前上山`:"如果本来就要上山，可以顺手看一眼；不建议专程跑";return`${Dt(a)} ${l} 前后，${p}${u}，看到${W[t].name}概率 ${e.probability}%。${h}。山顶约 ${f} ℃，带一件防风外套。`}function en({all:e=[],mode:t="cloudsea",todayProb:n}){if(!e.length)return null;const a=Number.isFinite(n)?n:e[0].probability,s=e.find((o,r)=>r>0&&o.probability>=Math.max(55,a+15));return s?{tone:"hopeful",text:`这次没等到不怪你。${s.index} 天后（${Dt(s.day)}）有 ${s.probability}% 的窗口，比今天高 ${s.probability-a} 个百分点。到那天我会提前提醒你。`,target:s}:{tone:"consoling",text:`未来一周${W[t].name}的机会都不好，最高只有 ${Math.max(...e.map(o=>o.probability))}%。这次别硬上，把体力留给下一次。`,target:null}}const nn="feedback",va=8,ke=.9;let nt=null;async function an(){return nt||(nt=await ue(nn)),nt}async function ga({mountainId:e,mode:t,date:n,predicted:a,observed:s,source:i="demo"}){const o={id:`${e}_${t}_${n}`,mountainId:e,mode:t,date:n,predicted:Math.round(Number(a)||0),observed:s?1:0,source:i,ts:Date.now()};if(await Rt(nn,o),nt){const r=nt.findIndex(c=>c.id===o.id);r>=0?nt[r]=o:nt.push(o)}return o}async function It(e,t){const a=(await an()).filter(u=>u.mountainId===e&&u.mode===t);if(!a.length)return{offset:0,n:0,hitRate:null,meanPredicted:null};const s=a.reduce((u,p)=>u+(p.observed?1:0),0),i=a.reduce((u,p)=>u+p.predicted,0)/a.length/100,o=s/a.length,r=a.length/(a.length+va),c=oe(o)-oe(i);return{offset:$t(c*r,-ke,ke),n:a.length,hitRate:o,meanPredicted:i,note:a.length<3?`已收集 ${a.length} 次反馈，满 3 次开始参与校准`:`基于你的 ${a.length} 次反馈：实测命中 ${Math.round(o*100)}%，模型平均预测 ${Math.round(i*100)}%`}}async function Vt(){const e=await an();return{total:e.length,rows:e}}function ya(){nt=null}const Xt={一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};function ba(e){if(!e)return null;if(e==="半")return .5;if(e.includes("十")){const[t,n]=e.split("十");return(Xt[t]||1)*10+(n&&Xt[n]||0)}return Xt[e]??null}function wa(e){let t=e.match(/(\d+(?:\.\d+)?)\s*个?\s*小时/);return t?Number(t[1]):(t=e.match(/([一两二三四五六七八九十半])\s*个?\s*小时/),t?ba(t[1]):/半小时/.test(e)?.5:/半天/.test(e)?3.5:/一整天|全天|一天/.test(e)?8:null)}function _a(e){const t=e.match(/爬升\s*(?:不超过|少于|控制在)?\s*(\d{2,4})\s*(?:米|m)/);return t?Number(t[1]):null}const xa=[{key:"日出",re:/日出|看太阳|晨光/},{key:"日落",re:/日落|夕阳/},{key:"云海",re:/云海/},{key:"星空",re:/星空|银河|看星|星轨/},{key:"海景",re:/海景|看海|海边/},{key:"溪谷",re:/溪谷|溪流|瀑布|玩水/},{key:"城市",re:/城市|夜景|灯光/},{key:"夜爬",re:/夜爬|晚上爬|下班后/},{key:"越野跑",re:/越野跑|跑步|训练/},{key:"重装",re:/重装|露营|过夜/}],$a={日出:["日出"],日落:["日落"],云海:["云海"],星空:["观星","星空"],海景:["海景"],溪谷:["溪谷","瀑布"],城市:["城市"],夜爬:["夜爬"],越野跑:["越野跑"],重装:["重装"]},sn=(e,t)=>($a[t]||[t]).some(n=>e.tags.includes(n));function Ma(e=""){const t=String(e).trim(),n={maxHours:wa(t),maxAscent:_a(t),difficultyMin:null,difficultyMax:null,tags:new Set,audience:null,kidAge:null},a=[],s=[];for(const c of xa)c.re.test(t)&&n.tags.add(c.key);n.tags.size&&a.push(`想要${[...n.tags].join(" / ")}`),n.maxHours&&a.push(`${n.maxHours} 小时以内`),n.maxAscent&&a.push(`爬升不超过 ${n.maxAscent} 米`);const i=t.match(/(\d{1,2})\s*岁/),o=/孩子|小孩|娃|儿子|女儿|亲子|带娃/.test(t),r=/爸妈|父母|老人|长辈|爷爷|奶奶/.test(t);return o||i?(n.audience="kid",n.kidAge=i?Number(i[1]):null,n.difficultyMax=n.kidAge&&n.kidAge<=8?2:3,n.maxHours==null&&(n.maxHours=4),a.push(n.kidAge?`带 ${n.kidAge} 岁小孩`:"带孩子")):r?(n.audience="elder",n.difficultyMax=2,n.maxHours==null&&(n.maxHours=4),a.push("有长辈同行")):/新手|第一次|没爬过|小白/.test(t)?(n.audience="beginner",n.difficultyMax=2,a.push("新手友好")):/有经验|经常爬|老手|挑战|虐|强度大/.test(t)&&(n.audience="expert",n.difficultyMin=3,a.push("想要有强度")),/停车场|停车/.test(t)&&s.push("停车场信息暂未收录"),/门票|收费/.test(t)&&s.push("门票价格暂未收录"),/水源|补水/.test(t)&&s.push("沿途水源点暂未收录"),{constraints:n,understood:a,unsupported:s,query:t}}function Sa({understood:e,unsupported:t}){if(!e.length)return"我还没听懂你的条件，可以试试「周六带 6 岁孩子，2 小时能来回」。";const n=`我理解你要的是：${e.join("，")}。`;return t.length?`${n}（${t.join("、")}，不参与筛选）`:n}function ka(e){const t=e.constraints,n=dt.map(r=>{const c=[...t.tags].filter(d=>sn(r,d)).length,u=t.maxHours?r.route.hours-t.maxHours:0,p=t.maxAscent?r.route.ascent-t.maxAscent:0;let f=0;t.difficultyMax!=null&&(f=Math.max(0,r.difficulty-t.difficultyMax)),t.difficultyMin!=null&&(f=Math.max(f,Math.max(0,t.difficultyMin-r.difficulty)));const l=t.tags.has("云海")||t.tags.has("星空")?(r.elevation-400)/600:0,h=c*3-Math.max(0,u)*1.6-Math.max(0,p)/180-f*2+l;return{mountain:r,score:h,tagHits:c,overHours:u,overAscent:p,difDelta:f}}),a=n.filter(r=>r.overHours<=.25&&r.overAscent<=60&&r.difDelta===0),s=a.length?a:n.filter(r=>r.overHours<=1.5&&r.difDelta<=1),i=!a.length,o=[...s.length?s:n].sort((r,c)=>c.score-r.score).slice(0,3).map(r=>({mountain:r.mountain,why:Ta(r,t)}));return{items:o,relaxed:i,note:i?"没有完全符合的路线，下面是放宽条件后最接近的三条——哪一条超了会写在理由里。":a.length>o.length?`有 ${a.length} 条符合，先看最合适的三条。`:`找到 ${a.length} 条符合的路线。`}}function Ta(e,t){const n=[];t.maxHours&&n.push(e.overHours<=0?`约 ${e.mountain.route.hours} 小时，在 ${t.maxHours} 小时内`:`约 ${e.mountain.route.hours} 小时，比你说的多 ${e.overHours.toFixed(1)} 小时`),t.maxAscent&&n.push(e.overAscent<=0?`爬升 ${e.mountain.route.ascent} 米`:`爬升 ${e.mountain.route.ascent} 米，略超 ${Math.round(e.overAscent)} 米`),t.difficultyMax!=null&&e.mountain.difficulty<=t.difficultyMax&&n.push(`难度 ${e.mountain.difficulty}/5，适合当前水平`);const a=[...t.tags].filter(s=>sn(e.mountain,s));return a.length&&n.push(`有${a.join("、")}`),n.length||n.push(e.mountain.desc),n.slice(0,3).join(" · ")}const Ca=["周六带 6 岁孩子，2 小时能来回","明早想看云海，能爬 3 小时的","一个人夜爬，安全的","想拍海景，半天强度"],Pa=[[5,"凌晨"],[8,"清晨"],[11,"上午"],[14,"正午"],[17,"下午"],[19,"傍晚"],[24,"夜里"]];function La(e){const t=new Date(e).getHours();for(const[n,a]of Pa)if(t<n)return a;return"夜里"}function Ea(e,t){const n=Number(String(t).match(/\d+/)?.[0]??0);return e?n>=6?"风大得站不稳":/东|南/.test(e)?"风从海上来":/北/.test(e)?"北风带着凉意":n<=2?"几乎没有风":`${e}吹着`:""}function Aa({trail:e={},weather:t=null,mountain:n={},mode:a="hike"}){const s=new Date(e.startedAt||Date.now()),i=new Date(e.endedAt||Date.now()),o=e.stats||{},r=t?.now||{},c=n.name||e.mountainName||"山里",u=n.elevation||o.maxEle||null,p=La(s),f=`${s.getMonth()+1} 月 ${s.getDate()} 日`,l=a==="cloudsea"?"等到了一场云海":a==="sunrise"?"守到了日出":a==="stars"?"看到了一整个银河":a==="dawn"?"赶在天亮前上了山":"走完了一段山路",h=[];h.push(`${f}${p}`),h.push(q(s,!1).slice(0,5)),h.push(`你在${c}${l}`),u&&h.push(`海拔 ${u} 米`),r.temp!==void 0&&h.push(`气温 ${r.temp}℃`);const d=Ea(r.windDir,r.windScale);d&&h.push(d);const m=h.join("，").replace(/，(\d{2}:\d{2})$/," $1")+"。",_=[];o.distanceKm&&_.push(`${Number(o.distanceKm).toFixed(1)} 公里`),o.elevation?.gain&&_.push(`累计爬升 ${o.elevation.gain} 米`);const y=(i-s)/36e5;return y>.1&&y<30&&_.push(`用时 ${y.toFixed(1)} 小时`),{headline:m,detail:_.join(" · "),tags:Da({mode:a,weather:t,elevation:u}),meta:{date:f,time:q(s,!1).slice(0,5),place:c,elevation:u,coord:e.points?.[0]?`${e.points[0].lat.toFixed(4)}, ${e.points[0].lon.toFixed(4)}`:"",temp:r.temp,weather:r.text||""}}}function Da({mode:e,weather:t,elevation:n}){const a=[];e!=="hike"&&a.push({sunrise:"日出",cloudsea:"云海",stars:"星空"}[e]),Number(n)>=900&&a.push("千米峰");const s=Number(t?.now?.vis);return Number.isFinite(s)&&s>=15&&a.push("通透"),t?.now?.text&&a.push(t.now.text),a.filter(Boolean).slice(0,3)}function Na(e,t){if(!t||!e)return null;const n=e.stats||{},a=t.stats||{},s=(n.elevation?.gain||0)-(a.elevation?.gain||0),i=(n.distanceKm||0)-(a.distanceKm||0);return Math.abs(s)>=30?s>0?`比上次多爬了 ${Math.round(s)} 米，进步了。`:`比上次少爬 ${Math.abs(Math.round(s))} 米，这次是收着走的。`:Math.abs(i)>=.5?i>0?`比上次多走了 ${i.toFixed(1)} 公里。`:`比上次短 ${Math.abs(i).toFixed(1)} 公里，轻松一些。`:"和上次强度相当，稳定输出。"}function Ia(e=[]){if(!e.length)return null;const t=new Date().getFullYear(),n=e.filter(r=>new Date(r.startedAt).getFullYear()===t);if(!n.length)return null;const a=n.reduce((r,c)=>r+(c.stats?.distanceKm||0),0),s=n.reduce((r,c)=>r+(c.stats?.elevation?.gain||0),0),i=n.filter(r=>new Date(r.startedAt).getHours()<8).length,o=new Set(n.map(r=>new Date(r.startedAt).getMonth()));return{year:t,count:n.length,km:Number(a.toFixed(1)),gain:Math.round(s),dawn:i,months:o.size,text:`${t} 年你上山 ${n.length} 次，累计 ${a.toFixed(1)} 公里、爬升 ${Math.round(s)} 米，其中 ${i} 次是为了赶天亮出门。`}}const Ha=["cloudsea","sunrise","stars"],Ra=[{id:"chase",name:"追光",desc:"概率 · 坡向 · 时间",icon:"sunrise",tone:"dawn"},{id:"trail",name:"轨迹",desc:"记录 · 卡片",icon:"footprint",tone:""},{id:"weather",name:"天气",desc:"实时 · 预警",icon:"cloudSun",tone:""}];function Oa(e){const t=Date.now();return e.find(n=>{const a=n.day.dateObj instanceof Date?n.day.dateObj:new Date(n.day.date),s=st(a,22.58,114.2);return s.sunrise?n.index>0||t<s.sunrise.getTime()+30*6e4:n.index>0})||e[0]}const ja={id:"home",title:"首页",icon:"home",template(){const e=D();return`
      <section class="hero" id="homeHero">
        <div class="hero__sky"></div>
        <div class="hero__sun"></div>
        <div class="hero__horizon"></div>
        <div class="hero__ridge hero__ridge--far"></div>
        <div class="hero__ridge hero__ridge--mid"></div>
        <div class="hero__ridge hero__ridge--near"></div>
        <div class="hero__mist"></div>
        <div class="hero__content">
          <div class="hero__meta">
            <span class="badge badge--glass badge--dot" id="heroSource">读取中</span>
            <span id="heroDate">--</span>
          </div>
          <h1 class="hero__title">晓山青</h1>
          <p class="hero__tagline">不问天气好不好，只回答值不值得去</p>
          <div class="hero__panel">
            <div class="hero__temp">
              <strong id="heroTemp">--</strong><span>°C</span>
              <span id="heroCond" style="margin-left:6px">读取中…</span>
            </div>
            <div class="hero__actions">
              <button class="hero__btn hero__btn--dawn" type="button" data-go="chase">${x("sunrise",14)} 追光</button>
            </div>
          </div>
        </div>
      </section>

      <section class="verdict" id="verdictCard">
        <div class="verdict__head">
          <span class="verdict__kicker" id="verdictKicker">${x("sparkles",13)} 正在计算</span>
          <button class="verdict__mountain" type="button" data-action="mountain" id="verdictMountain">
            ${e.name} ${x("chevronDown",13)}
          </button>
        </div>

        <div class="verdict__main">
          <div class="verdict__prob">
            <span class="verdict__num" id="verdictNum">--</span><span class="verdict__pct">%</span>
          </div>
          <div class="verdict__side">
            <div class="verdict__mode" id="verdictMode">云海</div>
            <div class="verdict__grade" id="verdictGrade">--</div>
          </div>
        </div>

        <p class="verdict__sentence" id="verdictSentence">正在根据温湿与逆温条件估算…</p>

        <div class="verdict__facts" id="verdictFacts"></div>

        <div class="verdict__foot">
          <span id="verdictFoot">基准率 --</span>
          <button class="btn btn--sm btn--ghost" type="button" data-go="chase">看七天窗口 ${x("chevronRight",13)}</button>
        </div>
      </section>

      <div class="mini-modes" id="miniModes"></div>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">问一句</h2>
            <p class="section__desc">说出条件，直接给路线，不聊天</p>
          </div>
        </div>
        <form class="ask" id="askForm">
          <span class="ask__icon">${x("search",17)}</span>
          <input class="ask__input" id="askInput" type="text" autocomplete="off"
            placeholder="例：周六带 6 岁孩子，2 小时能来回" />
          <button class="ask__btn" type="submit">${x("chevronRight",17)}</button>
        </form>
        <div class="ask__chips" id="askChips">
          ${Ca.map(t=>`<button class="chip chip--sm" type="button" data-chip="${L(t)}">${L(t)}</button>`).join("")}
        </div>
        <div id="askResult"></div>
      </section>

      <section class="section" id="compensateSection" hidden>
        <div class="compensate" id="compensateCard"></div>
      </section>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">三个功能</h2>
            <p class="section__desc">能用的只有这三个，其他都下架了</p>
          </div>
        </div>
        <div class="feature-grid feature-grid--3">
          ${Ra.map(t=>`<button class="feature ${t.tone?`feature--${t.tone}`:""}" type="button" data-go="${t.id}">
              <span class="feature__icon">${x(t.icon,18)}</span>
              <span class="feature__name">${t.name}</span>
              <span class="feature__desc">${t.desc}</span>
            </button>`).join("")}
        </div>
      </section>

      <section class="section" id="recapSection" hidden>
        <div class="recap" id="recapCard"></div>
      </section>

      <section class="section" id="recentSection">
        <div class="section__head">
          <div>
            <h2 class="section__title">最近轨迹</h2>
            <p class="section__desc">保存在本机，可导出 GPX 或生成卡片</p>
          </div>
          <button class="btn btn--sm btn--ghost" type="button" data-go="trail">去记录</button>
        </div>
        <div class="card card--flush" id="recentTrails">
          <div class="loading-inline"><span class="spinner"></span>读取中…</div>
        </div>
      </section>

      <footer class="center muted" style="font-size:11px;padding:10px 0 4px">
        晓山青 Viridiore · <span id="homeVersion">v2.0</span> · 无痕山林，只带走照片
      </footer>
    `},async mount(e){const t=d=>e.querySelector(d),n=D();e.addEventListener("click",d=>{const m=d.target.closest("[data-go]");if(m){bt(m.dataset.go);return}d.target.closest('[data-action="mountain"]')&&p()}),t("#heroDate").textContent=vt(new Date,!0);let a={offset:0,n:0};const s=d=>{if(!d?.daily?.length)return;const m=D(),_=At(d.daily,"cloudsea",{mountain:m,source:d.source,calibration:a}),y=Oa(_.all);if(!y)return;const k=y.probability,P=y.index===0?"今天清晨":y.index===1?"明天清晨":`${y.index} 天后`,T=y.day.dateObj instanceof Date?y.day.dateObj:new Date(y.day.date),v=st(T,m.lat,m.lon);t("#verdictKicker").innerHTML=`${x("sparkles",13)} ${P} · ${q(v.sunrise,!1).slice(0,5)} 前后`,t("#verdictNum").textContent="0",t("#verdictNum").dataset.target=String(k),_n(t("#verdictNum"),k,{duration:700}),t("#verdictMode").textContent="云海概率",t("#verdictGrade").textContent=y.grade.label,t("#verdictGrade").className=`verdict__grade is-${y.grade.tone}`,t("#verdictSentence").textContent=tn(y,"cloudsea",m);const b=[];if(y.factors.slice(0,2).forEach(w=>b.push({tone:w.tone,text:w.detail||`${w.label} ${w.value}`})),y.probability>=22){const w=Nt(y.day,m.elevation);w!=null&&b.push({tone:"neutral",text:`山顶约 ${w} ℃`})}t("#verdictFacts").innerHTML=b.filter(w=>w.text).slice(0,3).map(w=>`<span class="verdict__fact is-${w.tone}">
            <i>${w.tone==="pro"?"＋":w.tone==="con"?"－":"·"}</i>${L(w.text)}
          </span>`).join(""),t("#verdictFoot").textContent=`基准率 ${y.baseRate}% · 置信度 ${y.confidence.label}${d.source==="demo"?" · 演示数据":""}`;const S=Ha.map(w=>{const $=w==="cloudsea"?y:At(d.daily,w,{mountain:m,source:d.source,calibration:a}).all[y.index];return{key:w,name:W[w].name,prob:$?.probability??0,icon:W[w].icon}});t("#miniModes").innerHTML=S.map(w=>`<button class="mini-mode ${w.key==="cloudsea"?"is-active":""}" type="button" data-mode="${w.key}">
            <span class="mini-mode__icon">${x(w.icon,15)}</span>
            <span class="mini-mode__name">${w.name}</span>
            <span class="mini-mode__prob">${w.prob}%</span>
          </button>`).join("");const g=en({all:_.all,mode:"cloudsea",todayProb:y.probability}),M=y.probability<55&&g;t("#compensateSection").hidden=!M,M&&(t("#compensateCard").innerHTML=`
          <span class="compensate__icon">${x(g.tone==="hopeful"?"sunrise":"moon",18)}</span>
          <p>${L(g.text)}</p>`,t("#compensateCard").classList.toggle("is-hopeful",g.tone==="hopeful")),e.querySelectorAll("[data-mode]").forEach(w=>{w.addEventListener("click",()=>bt(`chase?mode=${w.dataset.mode}`))})},i=d=>{if(!d)return;t("#heroTemp").textContent=d.now.temp,t("#heroCond").textContent=`体感 ${d.now.feels}°`;const m=t("#heroSource");m.textContent=d.source==="live"?"实时数据":"演示数据",m.style.opacity=d.source==="live"?"1":"0.85"},o=t("#askForm"),r=t("#askInput"),c=t("#askResult"),u=d=>{const m=Ma(d);r.value=d;const _=Sa(m),y=ka(m),k=y.items.map(P=>`<button class="route-card" type="button" data-pick="${P.mountain.id}">
            <span class="route-card__main">
              <span class="route-card__name">${P.mountain.name}
                <small>${P.mountain.elevation} m · 难度 ${P.mountain.difficulty}/5</small>
              </span>
              <span class="route-card__why">${L(P.why)}</span>
            </span>
            <span class="route-card__go">${x("chevronRight",15)}</span>
          </button>`).join("");c.innerHTML=`
        <p class="ask__echo">${L(_)}</p>
        ${m.understood.length?`<p class="ask__note">${L(y.note)}</p>`:""}
        <div class="route-list">${k||'<div class="empty"><div class="empty__title">没有匹配的路线</div></div>'}</div>`};o.addEventListener("submit",d=>{d.preventDefault();const m=r.value.trim();m&&u(m)}),t("#askChips").addEventListener("click",d=>{const m=d.target.closest("[data-chip]");m&&u(m.dataset.chip)}),c.addEventListener("click",d=>{const m=d.target.closest("[data-pick]");m&&(re(m.dataset.pick),bt("chase"))});function p(){const d=`<div class="list">
        ${dt.map(y=>`<button class="list-row" type="button" data-mountain="${y.id}">
            <span class="list-row__icon">${x("mountain",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${y.name} <span class="muted" style="font-weight:400">${y.elevation}m</span></span>
              <span class="list-row__sub">${y.area} · ${y.tags.slice(0,3).join(" / ")}</span>
            </span>
            <span class="list-row__tail">${y.id===A.mountainId?"当前":""}</span>
          </button>`).join("")}
      </div>`,{el:m,close:_}=he({title:"换个山头",body:d});m.addEventListener("click",y=>{const k=y.target.closest("[data-mountain]");k&&(re(k.dataset.mountain),_(),t("#verdictMountain").innerHTML=`${D().name} ${x("chevronDown",13)}`,It(k.dataset.mountain,"cloudsea").then(P=>(a=P,lt())).then(P=>s(P)))})}const f=async()=>{const d=t("#recentTrails"),m=await _t.list();if(!m.length){d.innerHTML=`
          <div class="empty">
            ${x("footprint",34)}
            <div class="empty__title">还没有记录过轨迹</div>
            <div class="empty__desc">上山前点一下「开始记录」，下山后能生成一张带天气的卡片</div>
          </div>`,t("#recapSection").hidden=!0;return}d.innerHTML=`<div style="padding:6px 14px 10px">
        ${m.slice(0,3).map((k,P)=>`<button class="list-row" type="button" data-trail="${k.id}">
              <span class="list-row__icon">${x("route",18)}</span>
              <span class="list-row__main">
                <span class="list-row__title">${L(k.name)}</span>
                <span class="list-row__sub">${vt(k.startedAt)} · ${ce((k.stats?.distanceKm||0)*1e3)} · 爬升 ${k.stats?.elevation?.gain||0} m</span>
              </span>
              <span class="list-row__tail">${P===0?sa(k.startedAt):""}</span>
            </button>`).join("")}
      </div>`;const _=Ia(m);_&&(t("#recapSection").hidden=!1,t("#recapCard").innerHTML=`
          <span class="recap__year">${_.year}</span>
          <p>${_.text}</p>`);const y=Na(m[0],m[1]);if(y&&m[0]?.id){const k=d.querySelector(`[data-trail="${m[0].id}"] .list-row__sub`);k&&(k.textContent=`${ce((m[0].stats?.distanceKm||0)*1e3)} · ${y}`)}};e.addEventListener("click",d=>{d.target.closest("[data-trail]")&&bt("trail")});const l=H.on("weather:change",d=>{i(d),s(d)}),h=H.on("trail:change",f);try{a=await It(n.id,"cloudsea");const d=await lt();i(d),s(d)}catch(d){t("#verdictSentence").textContent="天气数据获取失败，稍后重试。",X(d.message||"天气获取失败")}return f(),t("#homeVersion").textContent="v2.1.0",()=>{l(),h()}},onShow(){lt().catch(()=>{})}},za=63710088e-1;function qa(e,t){const n=c=>c*Math.PI/180,a=n(t.lat-e.lat),s=n(t.lon-e.lon),i=n(e.lat),o=n(t.lat),r=Math.sin(a/2)**2+Math.cos(i)*Math.cos(o)*Math.sin(s/2)**2;return 2*za*Math.asin(Math.min(1,Math.sqrt(r)))}function Fa(e,t){let n=ct[0],a=1/0;for(const s of ct){const i=qa({lat:e,lon:t},s);i<a&&(a=i,n=s)}return{...n,distance:a}}function Ba(e={}){const{timeout:t=12e3,maximumAge:n=3e4,enableHighAccuracy:a=!0}=e;return new Promise((s,i)=>{if(!("geolocation"in navigator)){i(new Error("当前环境不支持定位"));return}navigator.geolocation.getCurrentPosition(o=>s({lat:o.coords.latitude,lon:o.coords.longitude,accuracy:o.coords.accuracy,altitude:o.coords.altitude,heading:o.coords.heading,speed:o.coords.speed,ts:o.timestamp}),o=>{const r={1:"定位权限被拒绝，请在系统设置中允许",2:"暂时无法获取位置，请到空旷处重试",3:"定位超时，请重试"};i(new Error(r[o.code]||o.message))},{timeout:t,maximumAge:n,enableHighAccuracy:a})})}function Te(e,t,n={}){if(!("geolocation"in navigator))return t?.(new Error("当前环境不支持定位")),()=>{};const a=navigator.geolocation.watchPosition(s=>e({lat:s.coords.latitude,lon:s.coords.longitude,accuracy:s.coords.accuracy,altitude:s.coords.altitude,heading:s.coords.heading,speed:s.coords.speed,ts:s.timestamp}),s=>t?.(new Error(s.message||"定位失败")),{enableHighAccuracy:!0,maximumAge:1e3,timeout:2e4,...n});return()=>navigator.geolocation.clearWatch(a)}function Wa(e){return e<=50?"badge--moss":e<=100?"badge--dawn":e<=150?"badge--warn":"badge--danger"}function Ce(e=""){return{Minor:1,Moderate:2,Severe:3,Extreme:4}[e]||1}function Ua(e=""){return{Minor:"minor",Moderate:"moderate",Severe:"severe",Extreme:"extreme"}[e]||"minor"}const Za={id:"weather",title:"天气",icon:"cloudSun",template(){return`
      <div class="page-head">
        <div>
          <h1 class="page-head__title">天气</h1>
          <p class="page-head__desc" id="wxUpdated">正在获取天气数据…</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="locate" title="使用我的位置">${x("crosshair",19)}</button>
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${x("refresh",19)}</button>
        </div>
      </div>

      <div id="wxWarnings"></div>

      <div class="wx-hero" id="wxHero">
        <div class="wx-hero__top">
          <button class="wx-city" type="button" data-action="city">
            ${x("map",15)}<span id="wxCityName">${A.location.name}</span>${x("chevronDown",13)}
          </button>
          <span class="badge badge--glass" id="wxSource">--</span>
        </div>
        <div class="wx-hero__main">
          <div>
            <div class="wx-now">
              <span class="wx-now__temp" id="wxTemp">--</span><span class="wx-now__deg">°</span>
            </div>
            <div class="wx-now__cond" id="wxCond">加载中</div>
            <div class="wx-now__feel" id="wxFeel">&nbsp;</div>
          </div>
          <div class="wx-now__icon" id="wxIcon">${x("cloudSun",84)}</div>
        </div>
        <div class="wx-metrics" id="wxMetrics">
          ${["湿度","风","气压","能见度"].map(e=>`
            <div class="wx-metric">
              <div class="wx-metric__k">${e}</div>
              <div class="wx-metric__v" data-metric="${e}">--</div>
            </div>`).join("")}
        </div>
      </div>

      <section class="section" style="margin-top:18px">
        <div class="section__head">
          <div><h2 class="section__title">未来 24 小时</h2></div>
          <span class="badge" id="wxRainBadge">${x("droplet",12)} 降水</span>
        </div>
        <div class="card" style="padding:10px 12px">
          <div class="hourly-scroll" id="wxHourly">
            ${Array.from({length:6}).map(()=>'<div class="skeleton" style="width:62px;height:96px;flex:none"></div>').join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div><h2 class="section__title">7 日预报</h2></div>
          <span class="badge" id="wxAirBadge">AQI --</span>
        </div>
        <div class="card" id="wxDaily" style="padding:6px 16px">
          <div class="loading-inline"><span class="spinner"></span>加载中…</div>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><div><h2 class="section__title">生活与户外</h2></div></div>
        <div class="index-grid" id="wxIndices"></div>
      </section>

      <section class="section">
        <div class="card">
          <div class="card__head">
            <span class="card__title">${x("info",16)} 数据说明</span>
          </div>
          <div class="kv"><span class="kv__k">数据来源</span><span class="kv__v" id="wxProvider">--</span></div>
          <div class="kv"><span class="kv__k">更新于</span><span class="kv__v" id="wxTime">--</span></div>
          <div class="kv"><span class="kv__k">日出 / 日落</span><span class="kv__v" id="wxSun">--</span></div>
          <div class="kv"><span class="kv__k">月相</span><span class="kv__v" id="wxMoon">--</span></div>
          <p class="field__hint" style="margin-top:10px">
            未配置和风天气 Key 时使用本地演示数据；配置后自动切换真实预报。
          </p>
        </div>
      </section>
    `},async mount(e){const t=r=>e.querySelector(r),n=r=>{if(!r)return;const{now:c,hourly:u,daily:p,air:f,indices:l,sun:h,moon:d}=r;t("#wxCityName").textContent=r.place.name,t("#wxSource").textContent=r.source==="live"?"和风天气":"演示数据",t("#wxTemp").textContent=c.temp,t("#wxCond").textContent=`${c.text}`;const m=r.warnings||[],_=t("#wxWarnings");if(!m.length)_.innerHTML="";else{const T=[...m].sort((v,b)=>Ce(b.severity)-Ce(v.severity));_.innerHTML=T.slice(0,3).map(v=>`<div class="warn-banner is-${Ua(v.severity)}">
              <span class="warn-banner__icon">${x("alert",17)}</span>
              <span class="warn-banner__main">
                <span class="warn-banner__title">${L(v.title||v.typeName||"气象预警")}</span>
                <span class="warn-banner__time">${L(v.typeName||"")}${v.pubTime?` · ${q(new Date(v.pubTime))} 发布`:""}</span>
              </span>
            </div>`).join("")}t("#wxFeel").textContent=`体感 ${c.feels}° · 今日 ${p[0]?.min??"--"}~${p[0]?.max??"--"}°`,t("#wxIcon").innerHTML=Ct(c.code,84),t("#wxMetrics").innerHTML=[["湿度",`${c.humidity}%`],["风",`${c.windDir} ${c.windScale}级`],["气压",`${c.pressure} hPa`],["能见度",`${c.vis} km`]].map(([T,v])=>`<div class="wx-metric"><div class="wx-metric__k">${T}</div><div class="wx-metric__v">${v}</div></div>`).join(""),t("#wxUpdated").textContent=`${q(r.updatedAt)} 更新 · ${r.source==="live"?"真实预报":"演示数据"}`;const y=t("#wxHourly");u?.length?y.innerHTML=u.map((T,v)=>{const b=v===0;return`<div class="hour ${b?"is-now":""}">
              <span class="hour__t">${b?"现在":q(T.time)}</span>
              <span class="hour__icon">${Ct(T.code,24)}</span>
              <span class="hour__temp">${T.temp}°</span>
              <span class="hour__pop">${T.pop>20?`${T.pop}%`:""}</span>
            </div>`}).join(""):y.innerHTML='<div class="empty__desc">暂无逐小时数据</div>';const k=t("#wxDaily");if(p?.length){const T=p.map(M=>M.min),v=p.map(M=>M.max),b=Math.min(...T),S=Math.max(...v),g=Math.max(1,S-b);k.innerHTML=p.map((M,w)=>{const $=w===0?"今天":w===1?"明天":Qe[M.dateObj.getDay()],C=(M.min-b)/g*100,N=Math.max(8,(M.max-M.min)/g*100);return`<div class="day-row">
              <span class="day-row__name">${$}</span>
              <span class="day-row__icon">${Ct(M.codeDay,22)}</span>
              <span class="day-row__bar"><span style="left:${C}%;width:${N}%"></span></span>
              <span class="day-row__temp"><b>${M.max}°</b> / ${M.min}°</span>
            </div>`}).join("")}f&&(t("#wxAirBadge").className=`badge ${Wa(f.aqi)}`,t("#wxAirBadge").textContent=`AQI ${f.aqi} ${f.category}`);const P=t("#wxIndices");if(l?.length){const T={1:"activity",2:"thermometer",3:"sun",5:"droplet",6:"tent",9:"heart"};P.innerHTML=l.slice(0,6).map(v=>`<div class="index-item">
              <span class="index-item__k">${x(T[v.type]||"info",13)}${v.name}</span>
              <span class="index-item__v">${L(v.category)}</span>
              <span class="index-item__d">${L(v.text)}</span>
            </div>`).join("")}else P.innerHTML="";t("#wxProvider").textContent=r.source==="live"?"和风天气 QWeather":"本地演示算法",t("#wxTime").textContent=q(r.updatedAt),t("#wxSun").textContent=h?.sunrise?`${q(h.sunrise)} / ${q(h.sunset)}`:"--",t("#wxMoon").textContent=d?`${d.phaseName} · 照亮 ${Math.round(d.illumination*100)}%`:"--",t("#wxRainBadge").innerHTML=`${x("droplet",12)} 降水概率`},a=async(r=!1)=>{try{const c=await lt(r);n(c)}catch(c){V(c.message||"天气加载失败")}},s=()=>{const c=`
        <div class="input-group" style="margin-bottom:14px">
          <input class="input" id="citySearch" placeholder="搜索城市，如 深圳 / 惠州" />
          <button class="btn btn--primary btn--sm" type="button" id="citySearchBtn">搜索</button>
        </div>
        <div id="cityList">
          ${[...new Set(ct.map(h=>h.group))].map(h=>`<div style="margin-bottom:12px">
                <div class="settings-group__title">${h}</div>
                ${ct.filter(d=>d.group===h).map(d=>`<button class="list-row" type="button" data-city='${JSON.stringify({name:d.name,lat:d.lat,lon:d.lon})}'>
                      <span class="list-row__main"><span class="list-row__title">${d.name}</span></span>
                      <span class="list-row__tail">${d.name===A.location.name?"当前":""}</span>
                    </button>`).join("")}
              </div>`).join("")}
        </div>`,{el:u,close:p}=he({title:"切换城市",body:c}),f=async h=>{xe(h),p(),I(`已切换到 ${h.name}`),await a(!0)};u.addEventListener("click",h=>{const d=h.target.closest("[data-city]");d&&f(JSON.parse(d.dataset.city))});const l=async()=>{const h=u.querySelector("#citySearch").value.trim();if(!h)return;const d=u.querySelector("#cityList");d.innerHTML='<div class="loading-inline"><span class="spinner"></span>搜索中…</div>';const m=await Xn(h),_=m.length?m:ct.filter(y=>y.name.includes(h)).map(y=>({...y,admin:y.group}));if(!_.length){d.innerHTML=`<div class="empty"><div class="empty__title">没有找到「${L(h)}」</div><div class="empty__desc">试试更短的关键词，或在设置中检查天气 API Host</div></div>`;return}d.innerHTML=_.map(y=>`<button class="list-row" type="button" data-city='${JSON.stringify({name:y.name,lat:Number(y.lat),lon:Number(y.lon)})}'>
              <span class="list-row__main">
                <span class="list-row__title">${L(y.name)}</span>
                <span class="list-row__sub">${L(y.admin||"")}</span>
              </span>
              <span class="list-row__tail">${x("chevronRight",15)}</span>
            </button>`).join("")};u.querySelector("#citySearchBtn").addEventListener("click",l),u.querySelector("#citySearch").addEventListener("keydown",h=>{h.key==="Enter"&&l()})},i=async()=>{const r=X("正在定位…",{duration:1500});try{const c=await Ba(),u=Fa(c.lat,c.lon);xe({name:u.name,lat:c.lat,lon:c.lon}),I(`已定位到 ${u.name} 附近`),await a(!0)}catch(c){V(c.message)}finally{r?.()}};e.addEventListener("click",async r=>{const c=r.target.closest("[data-action]");c&&(c.dataset.action==="refresh"&&(c.style.transform="rotate(360deg)",c.style.transition="transform .6s",setTimeout(()=>c.style.transform="",620),await a(!0)),c.dataset.action==="city"&&s(),c.dataset.action==="locate"&&i())});const o=H.on("weather:change",n);return await a(),()=>o()},onShow(){lt().catch(()=>{})}},j=1080,R=1350,B={skyTop:"#0b1a13",skyMid:"#1d3a2a",skyLow:"#5c6244",dawnSoft:"#f6d3a0",sun:"#fff2d0",ridgeMid:"#122a1d",ridgeNear:"#0a1710",ink:"#f2f7f2",inkSoft:"rgba(242,247,242,0.72)",inkFaint:"rgba(242,247,242,0.42)"},Pe='"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "STSong", serif',mt='"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';function Le(e,t,n,a,s,i){e.beginPath(),e.moveTo(t+i,n),e.arcTo(t+a,n,t+a,n+s,i),e.arcTo(t+a,n+s,t,n+s,i),e.arcTo(t,n+s,t,n,i),e.arcTo(t,n,t+a,n,i),e.closePath()}function Jt(e,t,n,a,s=42){const i=[];let o=e;const r=()=>(o=(o*9301+49297)%233280,o/233280);for(let c=0;c<=s;c++){const u=c/s,p=t-n*(.55*Math.sin(u*Math.PI*a+e)+.3*Math.sin(u*Math.PI*a*2.3+e*1.7)+.15*(r()-.5));i.push([u,p])}return i}function Qt(e,t,n,a,s){e.beginPath(),e.moveTo(0,s),t.forEach(([i,o])=>e.lineTo(i*a,o*s)),e.lineTo(a,s),e.closePath(),e.fillStyle=n,e.fill()}function Ga(e,t,n){const a=[];let s="";for(const i of t){const o=s+i;e.measureText(o).width>n&&s?(a.push(s),s=i):s=o}return s&&a.push(s),a}function Ee(e,t,n,a="  ·  "){const s=t.filter(Boolean);for(;s.length>1&&e.measureText(s.join(a)).width>n;)s.pop();return s.join(a)}function on({narrative:e,mode:t="hike",probability:n=null,sourceLabel:a=""}){const s=document.createElement("canvas");s.width=j,s.height=R;const i=s.getContext("2d"),o=e?.meta||{},r=i.createLinearGradient(0,0,0,R);r.addColorStop(0,B.skyTop),r.addColorStop(.42,B.skyMid),r.addColorStop(.66,B.skyLow),r.addColorStop(.78,"#c98a54"),r.addColorStop(1,"#20301f"),i.fillStyle=r,i.fillRect(0,0,j,R);const c=j*.7,u=R*.5,p=i.createRadialGradient(c,u,10,c,u,j*.62);p.addColorStop(0,"rgba(255,240,205,0.95)"),p.addColorStop(.12,"rgba(246,196,132,0.55)"),p.addColorStop(.42,"rgba(233,169,94,0.18)"),p.addColorStop(1,"rgba(233,169,94,0)"),i.fillStyle=p,i.fillRect(0,0,j,R),i.beginPath(),i.arc(c,u,54,0,Math.PI*2),i.fillStyle=B.sun,i.fill();for(let g=0;g<4;g++){const M=R*(.62+g*.035),w=i.createLinearGradient(0,M-40,0,M+40);w.addColorStop(0,"rgba(255,238,214,0)"),w.addColorStop(.5,`rgba(255,238,214,${.16-g*.03})`),w.addColorStop(1,"rgba(255,238,214,0)"),i.fillStyle=w,i.fillRect(0,M-40,j,80)}Qt(i,Jt(3.1,.72,.1,1.6),"rgba(38,66,46,0.85)",j,R),Qt(i,Jt(7.7,.8,.12,2.1),B.ridgeMid,j,R),Qt(i,Jt(12.3,.9,.1,2.8),B.ridgeNear,j,R);const f=i.createRadialGradient(j/2,R*.45,R*.25,j/2,R*.45,R*.78);if(f.addColorStop(0,"rgba(0,0,0,0)"),f.addColorStop(1,"rgba(5,12,8,0.55)"),i.fillStyle=f,i.fillRect(0,0,j,R),i.font=`500 26px ${mt}`,i.fillStyle=B.inkSoft,i.textAlign="left",i.textBaseline="middle",i.fillText("晓山青 · Viridiore",72,78),i.font=`400 22px ${mt}`,i.fillStyle="rgba(242,247,242,0.34)",i.textAlign="right",i.fillText(o.weather?`${o.weather}${o.temp!==void 0?` ${o.temp}℃`:""}`:"",j-72,78),Number.isFinite(n)){i.textAlign="left",i.font=`600 30px ${mt}`;const g=`${t==="stars"?"星空":t==="sunrise"?"日出":"云海"} ${n}%`,M=i.measureText(g).width+52;i.fillStyle="rgba(12,25,18,0.42)",Le(i,72,122,M,62,31),i.fill(),i.strokeStyle="rgba(246,211,160,0.4)",i.lineWidth=1.5,i.stroke(),i.fillStyle=B.dawnSoft,i.fillText(g,98,154)}const l=72,h=j-l*2,d=R-62;i.textAlign="left",i.textBaseline="alphabetic",i.fillStyle=B.ink,i.font=`300 126px ${Pe}`;const m=R-372;i.fillText(o.time||"--:--",l,m),i.font=`400 27px ${mt}`,i.fillStyle=B.inkSoft;const _=[];o.place&&_.push(o.place),o.elevation&&_.push(`海拔 ${o.elevation} 米`),e?.detail&&_.push(e.detail);const y=m+58;i.fillText(Ee(i,_,h),l,y),i.font=`400 37px ${Pe}`,i.fillStyle=B.ink;const k=Ga(i,e?.headline||"",h).slice(0,3),P=54,T=y+60;k.forEach((g,M)=>i.fillText(g,l,T+M*P));const b=T+(k.length-1)*P+58;if(e?.tags?.length&&b<d-34){let g=l;i.font=`500 22px ${mt}`,e.tags.slice(0,3).forEach(M=>{const w=i.measureText(M).width+34;i.strokeStyle="rgba(242,247,242,0.28)",i.lineWidth=1.2,Le(i,g,b-30,w,44,22),i.stroke(),i.fillStyle=B.inkSoft,i.fillText(M,g+17,b),g+=w+14})}i.font=`400 20px ${mt}`,i.fillStyle=B.inkFaint;const S=Ee(i,[o.coord,a||"离线记录"],h*.6);return i.fillText(S,l,d),i.textAlign="right",i.fillText(o.date||"",j-l,d),s}function rn(e){return new Promise((t,n)=>{e.toBlob?e.toBlob(a=>a?t(a):n(new Error("导出失败")),"image/png"):n(new Error("当前环境不支持导出图片"))})}async function Ht(e,t="xiaoshanqing.png"){const n=await rn(e),a=URL.createObjectURL(n),s=document.createElement("a");return s.href=a,s.download=t,document.body.appendChild(s),s.click(),s.remove(),setTimeout(()=>URL.revokeObjectURL(a),4e3),n}async function cn(e,{title:t,text:n}={}){if(!navigator.share||!navigator.canShare)return!1;try{const a=await rn(e),s=new File([a],"xiaoshanqing.png",{type:"image/png"});return navigator.canShare({files:[s]})?(await navigator.share({files:[s],title:t,text:n}),!0):!1}catch(a){return a?.name==="AbortError"}}const le=34,Ae=2*Math.PI*le;function De(e){const t=Ae*(1-e/100),n=e>=72?"#f0bb7f":e>=55?"#e5a457":e>=38?"#9dbd9f":"#7d8f83";return`<svg width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r="${le}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="5"/>
    <circle cx="42" cy="42" r="${le}" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${Ae}" stroke-dashoffset="${t}" style="transition:stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)"/>
  </svg>`}const Ka=()=>new Date().toISOString().slice(0,10),Ya={id:"chase",title:"追光",icon:"sunrise",template(){const e=D();return`
      <div class="page-head">
        <div>
          <h1 class="page-head__title">追光</h1>
          <p class="page-head__desc">七天窗口，每一天都给一个可被证伪的概率</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="mountain" title="换山头">${x("mountain",19)}</button>
          <button class="icon-btn" type="button" data-action="refresh" title="刷新">${x("refresh",19)}</button>
        </div>
      </div>

      <div class="segmented" style="margin-bottom:16px" id="chaseModes">
        ${["cloudsea","sunrise","stars"].map((t,n)=>`<button type="button" data-mode="${t}" class="${n===0?"is-active":""}">${W[t].name}</button>`).join("")}
      </div>

      <div class="chase-hero" id="chaseHero">
        <div class="chase-hero__glow"></div>
        <div class="chase-hero__top">
          <div>
            <div class="chase-mountain__name" id="chaseName">${e.name}</div>
            <div class="chase-mountain__meta" id="chaseMeta">海拔 ${e.elevation}m · ${e.area}</div>
          </div>
          <div class="chase-score">
            <div class="chase-score__ring" id="chaseRing">${De(0)}<div class="chase-score__prob" id="chaseProb">--</div></div>
            <div class="chase-score__label" id="chaseGrade">概率</div>
          </div>
        </div>
        <div class="chase-best">
          ${x("sunrise",20)}
          <div>
            <div class="chase-best__k" id="chaseBestK">最佳窗口</div>
            <div class="chase-best__v" id="chaseBest">正在计算…</div>
          </div>
        </div>
      </div>

      <p class="chase-sentence" id="chaseSentence">正在根据温湿与逆温条件估算…</p>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">七天窗口</h2>
            <p class="section__desc" id="chaseWindowDesc">按概率排序</p>
          </div>
        </div>
        <div class="chase-days" id="chaseDays">
          <div class="skeleton" style="height:56px"></div>
          <div class="skeleton" style="height:56px"></div>
          <div class="skeleton" style="height:56px"></div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">判断依据</h2>
            <p class="section__desc" id="chaseEvidenceDesc">每一项都可以被反驳</p>
          </div>
        </div>
        <div class="card card--flush" id="chaseFactors"></div>
      </section>

      <section class="section">
        <div class="card">
          <div class="card__head">
            <span class="card__title">${x("clock",16)} 天文时刻</span>
            <span class="badge" id="chaseMoon">--</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><div class="stat__label">日出</div><div class="stat__value" id="chaseSunrise">--:--</div></div>
            <div class="stat"><div class="stat__label">日落</div><div class="stat__value" id="chaseSunset">--:--</div></div>
            <div class="stat"><div class="stat__label">日出方位</div><div class="stat__value" id="chaseAzimuth">--</div></div>
            <div class="stat"><div class="stat__label">建议坡向</div><div class="stat__value" id="chaseSlope">--</div></div>
          </div>
          <div class="kv" style="margin-top:12px">
            <span class="kv__k">参考路线</span>
            <span class="kv__v" id="chaseRoute">--</span>
          </div>
          <div class="kv">
            <span class="kv__k">最佳季节</span>
            <span class="kv__v" id="chaseSeason">--</span>
          </div>
        </div>
        <p class="footnote" id="chaseFoot"></p>
      </section>

      <section class="section">
        <div class="feedback-card">
          <div class="feedback-card__text">
            <strong>今天这趟看到了吗</strong>
            <span>一次点击，让下一次的百分比更准。数据只留在本机。</span>
          </div>
          <div class="feedback-card__actions">
            <button class="btn btn--sm btn--ghost" type="button" data-feedback="1">${x("check",14)} 看到了</button>
            <button class="btn btn--sm btn--ghost" type="button" data-feedback="0">${x("x",14)} 白跑一趟</button>
          </div>
        </div>
      </section>

      <section class="section">
        <button class="btn btn--dawn btn--block btn--lg" type="button" data-action="share">
          ${x("share",17)} 生成预测卡
        </button>
      </section>
    `},async mount(e){const t=h=>e.querySelector(h);let n="cloudsea",a=null,s=null,i={offset:0,n:0},o=!1;const r=new URLSearchParams(location.hash.split("?")[1]||"").get("mode");r&&W[r]&&(n=r,e.querySelectorAll("[data-mode]").forEach(h=>h.classList.toggle("is-active",h.dataset.mode===n)));const c=()=>{if(!a||!s)return;const h=D();t("#chaseName").textContent=h.name,t("#chaseMeta").textContent=`海拔 ${h.elevation}m · ${h.area}`;const d=s.ranked[0];if(!d)return;t("#chaseRing").innerHTML=De(d.probability);const m=document.createElement("div");m.className="chase-score__prob",m.id="chaseProb",m.innerHTML=`${d.probability}<small>%</small>`,t("#chaseRing").appendChild(m),t("#chaseGrade").textContent=`${W[n].name} · ${d.grade.label}`;const _=d.day.dateObj instanceof Date?d.day.dateObj:new Date(d.day.date),y=st(_,h.lat,h.lon),k=se(_,h.lat);t("#chaseBestK").textContent=n==="stars"?"最佳夜空":`${Se(d.index,d.day)} · ${q(y.sunrise)} 前后`,t("#chaseBest").textContent=`${d.probability}% · ${d.verdict}`,t("#chaseSentence").textContent=tn(d,n,h);const P=[...s.all];t("#chaseDays").innerHTML=P.map(g=>{const M=g.index===d.index,w=Se(g.index,g.day);return`<div class="chase-day ${M?"is-best":""}">
            <span class="chase-day__date">${w}<small>${String(g.day.date).slice(5)}</small></span>
            <span class="chase-day__icon">${Ct(g.day.codeDay,22)}</span>
            <span class="chase-day__bar"><span style="width:${g.probability}%"></span></span>
            <span class="chase-day__score ${g.probability>=55?"is-high":""}">${g.probability}%</span>
          </div>`}).join(""),t("#chaseWindowDesc").textContent=`${W[n].name} · 基准率 ${d.baseRate}% · ${a.source==="demo"?"演示数据":"实时预报"}`,s.all[0].index===0?s.all[0].factors:d.factors;const T=s.all.find(g=>g.index===0)||d;t("#chaseEvidenceDesc").textContent=`以${T.index===0?"今天":"最佳日"}为例，共 ${T.factors.length} 项因子`,t("#chaseFactors").innerHTML=`<div class="factor-list">
        ${T.factors.map(g=>`<div class="factor ${g.tone}">
              <span class="factor__sign">${g.tone==="pro"?"+":"−"}</span>
              <span class="factor__main">
                <span class="factor__head"><b>${L(g.label)}</b><em>${L(String(g.value))}</em></span>
                <span class="factor__detail">${L(g.detail)}</span>
              </span>
              <span class="factor__delta">${g.delta>0?"+":""}${g.delta.toFixed(1)}</span>
            </div>`).join("")}
      </div>`;const v=Nt(T.day,h.elevation);t("#chaseMoon").textContent=a.moon?a.moon.phaseName:"--",t("#chaseSunrise").textContent=y.sunrise?q(y.sunrise):"--:--",t("#chaseSunset").textContent=y.sunset?q(y.sunset):"--:--",t("#chaseAzimuth").textContent=`${Math.round(k)}°`,t("#chaseSlope").textContent=Pt(k),t("#chaseRoute").textContent=`${h.route.distance} km / 爬升 ${h.route.ascent} m / 约 ${h.route.hours} h`,t("#chaseSeason").textContent=h.season;const b=T.confidence;t("#chaseFoot").innerHTML=`模型：月度基准率 + 云层高度（LCL）等 ${T.factors.length} 项物理证据。置信度 <b>${b.label}</b>（${b.hint}）${i.n?`；已用你 ${i.n} 次反馈校准（偏移 ${i.offset.toFixed(2)}）`:""}${v!=null?`。山顶约 ${v} ℃`:""}。`;const S=en({all:s.all,mode:n,todayProb:s.all[0]?.probability});s.all[0]&&s.all[0].probability<50&&S&&(t("#chaseSentence").textContent+=` ${S.text}`)},u=async(h=!1)=>{if(o)return;o=!0;const d=D();t("#chaseWindowDesc").textContent="正在获取山区天气…";try{i=await It(d.id,n),a=await Je({lat:d.lat,lon:d.lon,name:d.name,force:h}),s=At(a.daily,n,{mountain:d,source:a.source,calibration:i}),c()}catch(m){V(m.message||"数据加载失败")}finally{o=!1}},p=()=>{const h=D(),d=s.ranked[0],m=d.day.dateObj instanceof Date?d.day.dateObj:new Date(d.day.date),_=st(m,h.lat,h.lon),y=se(m,h.lat),k=Nt(d.day,h.elevation),P={headline:`${m.getMonth()+1} 月 ${m.getDate()} 日 ${q(_.sunrise)}，${h.name}${Pt(y)}，看到${W[n].name}概率 ${d.probability}%。`,detail:`山顶约 ${k} ℃`,tags:[W[n].name,`${d.probability}%`,d.grade.label],meta:{date:vt(m),time:q(_.sunrise),place:h.name,elevation:h.elevation,coord:`${h.lat.toFixed(4)}, ${h.lon.toFixed(4)}`,temp:k,weather:Pt(y)}},T=on({narrative:P,mode:n,probability:d.probability,sourceLabel:a.source==="demo"?"演示数据预测":"实时预报"});Ot({title:"预测卡",desc:"明天带着这张图上山，回来对照",wide:!0,body:'<div class="card-preview"><canvas id="cardCanvas"></canvas></div>',actions:[{label:"分享",variant:"primary",close:!1,onClick:async()=>{await cn(T,{title:"晓山青 · 预测卡",text:P.headline})||(await Ht(T,`晓山青-预测-${d.day.date}.png`),I("已保存图片"))}},{label:"保存图片",close:!1,onClick:async()=>{await Ht(T,`晓山青-预测-${d.day.date}.png`),I("已保存图片")}}],onMount:v=>{const b=v.querySelector("#cardCanvas");b&&(b.width=T.width,b.height=T.height,b.getContext("2d").drawImage(T,0,0))}})},f=async h=>{const d=s.all.find(m=>m.index===0);d&&(await ga({mountainId:D().id,mode:n,date:Ka(),predicted:d.probability,observed:h,source:a.source}),i=await It(D().id,n),s=At(a.daily,n,{mountain:D(),source:a.source,calibration:i}),c(),I(h?"记下了，恭喜看到":"记下了，模型会往下修正"))},l=()=>{const h=`<div class="list">
        ${dt.map(_=>`<button class="list-row" type="button" data-mountain="${_.id}">
            <span class="list-row__icon">${x("mountain",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${_.name} <span class="muted" style="font-weight:400">${_.elevation}m</span></span>
              <span class="list-row__sub">${_.area} · ${_.tags.join(" / ")}</span>
            </span>
            <span class="list-row__tail">${_.id===A.mountainId?"当前":""}</span>
          </button>`).join("")}
      </div>`,{el:d,close:m}=he({title:"选择山峰",body:h});d.addEventListener("click",_=>{const y=_.target.closest("[data-mountain]");y&&(re(y.dataset.mountain),m(),u(!0))})};return e.addEventListener("click",h=>{const d=h.target.closest("[data-mode]");if(d){n=d.dataset.mode,e.querySelectorAll("[data-mode]").forEach(y=>y.classList.toggle("is-active",y===d)),u(!1);return}const m=h.target.closest("[data-feedback]");if(m){f(m.dataset.feedback==="1");return}const _=h.target.closest("[data-action]");if(_&&(_.dataset.action==="mountain"&&l(),_.dataset.action==="refresh"&&u(!0),_.dataset.action==="share")){if(!s)return X("数据还没加载完");p()}}),await u(),()=>{}}},Va=256,ln=Va;function ft(e,t,n){const a=ln*Math.pow(2,n),s=Math.max(-85.05,Math.min(85.05,e)),i=(t+180)/360*a,o=Math.sin(s*Math.PI/180),r=(.5-Math.log((1+o)/(1-o))/(4*Math.PI))*a;return{x:i,y:r}}function Ne(e,t,n){const a=ln*Math.pow(2,n),s=e/a*360-180,i=Math.PI-2*Math.PI*t/a;return{lat:180/Math.PI*Math.atan(.5*(Math.exp(i)-Math.exp(-i))),lon:s}}function Xa(e,t){return 156543.03392*Math.cos(e*Math.PI/180)/Math.pow(2,t)}class Ja{constructor(t,n={}){this.canvas=t,this.ctx=t.getContext("2d"),this.options={minZoom:8,maxZoom:17,padding:36,onMarkerClick:null,onViewChange:null,...n},this.view={lat:22.55,lon:114.06,zoom:12},this.markers=[],this.path=[],this.selectedId=null,this.pointers=new Map,this.dragging=!1,this.lastPointer=null,this.pinchStart=null,this.raf=null,this.destroyed=!1,this._bind(),this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(t.parentElement||t),this.resize()}resize(){const t=this.canvas.parentElement||this.canvas,n=Math.min(window.devicePixelRatio||1,2.5),a=t.clientWidth,s=t.clientHeight;!a||!s||(this.width=a,this.height=s,this.canvas.width=Math.round(a*n),this.canvas.height=Math.round(s*n),this.canvas.style.width=`${a}px`,this.canvas.style.height=`${s}px`,this.ctx.setTransform(n,0,0,n,0,0),this.render())}setView(t){this.view={...this.view,...t},this.view.zoom=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom)),this.render()}setMarkers(t=[]){this.markers=t,this.render()}setPath(t=[]){this.path=t,this.render()}select(t){this.selectedId=t,this.render()}fitBounds(t,n=40){const a=(t||[]).filter(l=>Number.isFinite(l.lat)&&Number.isFinite(l.lon));if(!a.length)return;if(a.length===1){this.setView({lat:a[0].lat,lon:a[0].lon,zoom:14});return}let s=1/0,i=-1/0,o=1/0,r=-1/0;a.forEach(l=>{s=Math.min(s,l.lat),i=Math.max(i,l.lat),o=Math.min(o,l.lon),r=Math.max(r,l.lon)});const c={lat:(s+i)/2,lon:(o+r)/2};let u=this.view.zoom;const p=Math.max(40,this.width-n*2),f=Math.max(40,this.height-n*2);for(let l=this.options.maxZoom;l>=this.options.minZoom;l--){const h=ft(i,o,l),d=ft(s,r,l);if(Math.abs(d.x-h.x)<=p&&Math.abs(d.y-h.y)<=f){u=l;break}u=l}this.view={...c,zoom:u},this.render()}zoomBy(t){const n=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom+t));n!==this.view.zoom&&(this.view.zoom=n,this.render(),this.options.onViewChange?.(this.view))}project(t,n){const a=ft(this.view.lat,this.view.lon,this.view.zoom),s=ft(t,n,this.view.zoom);return{x:s.x-a.x+this.width/2,y:s.y-a.y+this.height/2}}unproject(t,n){const a=ft(this.view.lat,this.view.lon,this.view.zoom);return Ne(a.x+t-this.width/2,a.y+n-this.height/2,this.view.zoom)}_bind(){const t=this.canvas;t.style.touchAction="none",this._onPointerDown=n=>{if(t.setPointerCapture?.(n.pointerId),this.pointers.set(n.pointerId,{x:n.offsetX,y:n.offsetY}),this.pointers.size===2){const[a,s]=[...this.pointers.values()];this.pinchStart={dist:Math.hypot(a.x-s.x,a.y-s.y),zoom:this.view.zoom}}this.dragging=!0,this.moved=0,this.lastPointer={x:n.offsetX,y:n.offsetY}},this._onPointerMove=n=>{if(!this.pointers.has(n.pointerId))return;if(this.pointers.set(n.pointerId,{x:n.offsetX,y:n.offsetY}),this.pointers.size===2&&this.pinchStart){const[r,c]=[...this.pointers.values()],u=Math.hypot(r.x-c.x,r.y-c.y),p=u/(this.pinchStart.dist||u),f=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.pinchStart.zoom+Math.log2(p)));this.view.zoom=f,this.render();return}if(!this.dragging||!this.lastPointer)return;const a=n.offsetX-this.lastPointer.x,s=n.offsetY-this.lastPointer.y;this.moved+=Math.abs(a)+Math.abs(s),this.lastPointer={x:n.offsetX,y:n.offsetY};const i=ft(this.view.lat,this.view.lon,this.view.zoom),o=Ne(i.x-a,i.y-s,this.view.zoom);this.view.lat=Math.max(-84,Math.min(84,o.lat)),this.view.lon=o.lon,this.scheduleRender()},this._onPointerUp=n=>{this.pointers.delete(n.pointerId),this.pointers.size<2&&(this.pinchStart=null),this.pointers.size===0&&(this.dragging=!1,this.lastPointer=null,this.moved<6&&this._hitTest(n.offsetX,n.offsetY),this.options.onViewChange?.(this.view))},this._onWheel=n=>{n.preventDefault();const a=n.deltaY>0?-.5:.5,s=this.unproject(n.offsetX,n.offsetY),i=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom+a));if(i===this.view.zoom)return;this.view.zoom=i;const o=this.unproject(n.offsetX,n.offsetY);this.view.lat-=o.lat-s.lat,this.view.lon-=o.lon-s.lon,this.render(),this.options.onViewChange?.(this.view)},t.addEventListener("pointerdown",this._onPointerDown),t.addEventListener("pointermove",this._onPointerMove),t.addEventListener("pointerup",this._onPointerUp),t.addEventListener("pointercancel",this._onPointerUp),t.addEventListener("pointerleave",this._onPointerUp),t.addEventListener("wheel",this._onWheel,{passive:!1})}_hitTest(t,n){const a=[...this.markers].reverse().find(s=>{const i=this.project(s.lat,s.lon);return Math.hypot(i.x-t,i.y-n)<22});a&&(this.selectedId=a.id,this.render(),this.options.onMarkerClick?.(a))}scheduleRender(){this.raf||(this.raf=requestAnimationFrame(()=>{this.raf=null,this.render()}))}colors(){const t=getComputedStyle(document.documentElement),n=(a,s)=>t.getPropertyValue(a).trim()||s;return{moss:n("--moss-400","#649776"),mossDeep:n("--moss-600","#326046"),dawn:n("--dawn-400","#e5a457"),danger:n("--danger","#c04b40"),ink:n("--ink","#16261d"),text:n("--ink-2","#4c6156")}}render(){if(this.destroyed||!this.width)return;const{ctx:t,width:n,height:a}=this,s=this.colors();t.clearRect(0,0,n,a);const i=t.createLinearGradient(0,0,n,a);i.addColorStop(0,"#0d1d15"),i.addColorStop(.55,"#12291d"),i.addColorStop(1,"#0a1710"),t.fillStyle=i,t.fillRect(0,0,n,a),t.save(),t.globalAlpha=.5,[{x:n*.24,y:a*.32,r:a*.42,color:"rgba(63,107,76,0.28)"},{x:n*.74,y:a*.62,r:a*.5,color:"rgba(43,84,60,0.3)"},{x:n*.55,y:a*.15,r:a*.3,color:"rgba(90,120,80,0.16)"}].forEach(l=>{const h=t.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);h.addColorStop(0,l.color),h.addColorStop(1,"transparent"),t.fillStyle=h,t.beginPath(),t.arc(l.x,l.y,l.r,0,Math.PI*2),t.fill()}),t.restore();const r=64,c=this.project(this.view.lat,this.view.lon);t.strokeStyle="rgba(255,255,255,0.045)",t.lineWidth=1;const u=(c.x%r+r)%r,p=(c.y%r+r)%r;for(let l=u;l<n;l+=r)t.beginPath(),t.moveTo(Math.round(l)+.5,0),t.lineTo(Math.round(l)+.5,a),t.stroke();for(let l=p;l<a;l+=r)t.beginPath(),t.moveTo(0,Math.round(l)+.5),t.lineTo(n,Math.round(l)+.5),t.stroke();if(this.path.length>1){const l=this.path.map(_=>this.project(_.lat,_.lon)),h=(_,y,k)=>{t.save(),t.lineJoin="round",t.lineCap="round",t.lineWidth=_,t.strokeStyle=y,k&&(t.shadowColor=y,t.shadowBlur=k),t.beginPath(),l.forEach((P,T)=>T===0?t.moveTo(P.x,P.y):t.lineTo(P.x,P.y)),t.stroke(),t.restore()};h(9,"rgba(229,164,87,0.16)",0),h(4,s.dawn,8),h(1.4,"rgba(255,240,215,0.85)",0);const d=l[0],m=l[l.length-1];this._dot(d.x,d.y,5,"#8fd6a8"),this._dot(m.x,m.y,6,"#f0b268")}this._labelRects=[],this.markers.forEach(l=>{const h=this.project(l.lat,l.lon);h.x<-60||h.y<-60||h.x>n+60||h.y>a+60||this._marker(h,l)}),this._scaleBar(s);const f=t.createRadialGradient(n/2,a/2,Math.min(n,a)*.32,n/2,a/2,Math.max(n,a)*.78);f.addColorStop(0,"transparent"),f.addColorStop(1,"rgba(3,10,6,0.5)"),t.fillStyle=f,t.fillRect(0,0,n,a)}_dot(t,n,a,s){const{ctx:i}=this;i.beginPath(),i.arc(t,n,a+3,0,Math.PI*2),i.fillStyle="rgba(8,20,13,0.55)",i.fill(),i.beginPath(),i.arc(t,n,a,0,Math.PI*2),i.fillStyle=s,i.fill(),i.lineWidth=1.4,i.strokeStyle="rgba(255,255,255,0.85)",i.stroke()}_marker(t,n){const{ctx:a}=this,s=n.id===this.selectedId,i=n.color||"#e5a457";if(n.kind==="self"){const r=performance.now()%2e3/2e3;a.beginPath(),a.arc(t.x,t.y,10+r*20,0,Math.PI*2),a.fillStyle=`rgba(127,211,154,${.24*(1-r)})`,a.fill()}if(a.beginPath(),a.arc(t.x,t.y,s?8:6.5,0,Math.PI*2),a.fillStyle=i,a.fill(),a.lineWidth=2,a.strokeStyle="rgba(255,255,255,0.92)",a.stroke(),s&&(a.beginPath(),a.arc(t.x,t.y,15,0,Math.PI*2),a.strokeStyle="rgba(255,255,255,0.5)",a.lineWidth=1.2,a.stroke()),n.label&&(s||this.markers.length<=3||this.view.zoom>=13.2)&&this._labelRects.length<6){a.font=`600 ${10.5}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;const u=a.measureText(n.label).width+12,p=18,f=t.x-u/2,l=t.y-10-p;if(this._labelRects.some(m=>f<m.x+m.w+3&&f+u>m.x-3&&l<m.y+m.h+3&&l+p>m.y-3)&&!s)return;this._labelRects.push({x:f,y:l,w:u,h:p}),a.beginPath();const d=6;a.moveTo(f+d,l),a.arcTo(f+u,l,f+u,l+p,d),a.arcTo(f+u,l+p,f,l+p,d),a.arcTo(f,l+p,f,l,d),a.arcTo(f,l,f+u,l,d),a.closePath(),a.fillStyle=s?"rgba(229,164,87,0.94)":"rgba(9,22,15,0.8)",a.fill(),a.fillStyle=s?"#2c1d0c":"#e8f2ea",a.textAlign="center",a.textBaseline="middle",a.fillText(n.label,t.x,l+p/2)}}_scaleBar(t){const{ctx:n,width:a,height:s}=this,i=Xa(this.view.lat,this.view.zoom),r=i*80,c=[10,20,50,100,200,500,1e3,2e3,5e3,1e4,2e4,5e4].find(l=>l>=r/2)||5e4,u=c/i,p=14,f=s-18;n.strokeStyle="rgba(255,255,255,0.5)",n.lineWidth=1.5,n.beginPath(),n.moveTo(p,f-5),n.lineTo(p,f),n.lineTo(p+u,f),n.lineTo(p+u,f-5),n.stroke(),n.font='10px -apple-system, "PingFang SC", sans-serif',n.fillStyle="rgba(230,240,232,0.72)",n.textAlign="left",n.textBaseline="bottom",n.fillText(c>=1e3?`${c/1e3} km`:`${c} m`,p+2,f-6)}destroy(){this.destroyed=!0,cancelAnimationFrame(this.raf),this.resizeObserver?.disconnect();const t=this.canvas;t.removeEventListener("pointerdown",this._onPointerDown),t.removeEventListener("pointermove",this._onPointerMove),t.removeEventListener("pointerup",this._onPointerUp),t.removeEventListener("pointercancel",this._onPointerUp),t.removeEventListener("pointerleave",this._onPointerUp),t.removeEventListener("wheel",this._onWheel)}}class Qa{constructor(){this.worker=null,this.seq=0,this.pending=new Map}ensure(){return this.worker?this.worker:(this.worker=new Worker(new URL(""+new URL("trail.worker-BYy5JZCX.js",import.meta.url).href,import.meta.url),{type:"module"}),this.worker.addEventListener("message",t=>{const{id:n,ok:a,payload:s}=t.data||{},i=this.pending.get(n);i&&(this.pending.delete(n),a?i.resolve(s):i.reject(new Error(s?.message||"计算失败")))}),this.worker.addEventListener("error",t=>{console.warn("[worker]",t.message)}),this.worker)}post(t,n){const a=this.ensure(),s=++this.seq;return new Promise((i,o)=>{this.pending.set(s,{resolve:i,reject:o}),a.postMessage({id:s,type:t,payload:n}),setTimeout(()=>{this.pending.has(s)&&(this.pending.delete(s),o(new Error("计算超时")))},8e3)})}analyze(t){return this.post("ANALYZE",{points:t})}terminate(){this.worker?.terminate(),this.worker=null}}class ts{constructor({onUpdate:t,onError:n,onStatus:a}={}){this.onUpdate=t||(()=>{}),this.onError=n||(()=>{}),this.onStatus=a||(()=>{}),this.worker=new Qa,this.points=[],this.stats=null,this.startedAt=null,this.running=!1,this.paused=!1,this.stopWatch=null,this.lastAnalyze=0,this.analyzeTimer=null}get isRunning(){return this.running}async start(){this.running||(this.points=[],this.startedAt=Date.now(),this.running=!0,this.paused=!1,this.onStatus({running:!0,paused:!1,pointCount:0}),this.stopWatch=Te(t=>this.addPoint(t),t=>this.onError(t),{maximumAge:1e3}),this.analyzeTimer=setInterval(()=>this.recalc(),4e3))}pause(){this.running&&(this.paused=!0,this.stopWatch?.(),this.stopWatch=null,this.onStatus({running:!0,paused:!0,pointCount:this.points.length}))}resume(){!this.running||!this.paused||(this.paused=!1,this.stopWatch=Te(t=>this.addPoint(t),t=>this.onError(t),{maximumAge:1e3}),this.onStatus({running:!0,paused:!1,pointCount:this.points.length}))}addPoint(t){if(this.paused||!Number.isFinite(t.lat)||!Number.isFinite(t.lon)||t.accuracy&&t.accuracy>80)return;const n=this.points[this.points.length-1];if(n&&t.ts-n.ts<800)return;this.points.push({lat:t.lat,lon:t.lon,altitude:t.altitude,accuracy:t.accuracy,speed:t.speed,heading:t.heading,ts:t.ts||Date.now()}),this.onStatus({running:!0,paused:!1,pointCount:this.points.length});const a=Date.now();this.points.length>1&&a-this.lastAnalyze>1500&&this.recalc()}async recalc(){if(this.points.length){this.lastAnalyze=Date.now();try{const t=this.running&&this.points.length===1?[this.points[0],{...this.points[0],ts:Date.now()}]:this.points,n=await this.worker.analyze(t);this.stats=n,this.onUpdate(n,this.points)}catch(t){console.warn("[tracker] 计算失败",t)}}}async stop(){return this.running?(this.running=!1,this.paused=!1,this.stopWatch?.(),this.stopWatch=null,clearInterval(this.analyzeTimer),this.analyzeTimer=null,this.points.length>=2?await this.recalc():this.points.length===1&&await this.recalc(),this.onStatus({running:!1,paused:!1,pointCount:this.points.length}),{stats:this.stats,points:this.points,startedAt:this.startedAt,endedAt:Date.now()}):null}discard(){this.stopWatch?.(),this.stopWatch=null,clearInterval(this.analyzeTimer),this.analyzeTimer=null,this.running=!1,this.paused=!1,this.points=[],this.stats=null,this.startedAt=null,this.onStatus({running:!1,paused:!1,pointCount:0})}destroy(){this.discard(),this.worker.terminate()}}function de(e,t,n="text/plain"){const a=t instanceof Blob?t:new Blob([t],{type:n}),s=URL.createObjectURL(a),i=document.createElement("a");i.href=s,i.download=e,document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(s),4e3)}function Ie(e){const t=es(e.name||"晓山青轨迹"),n=new Date(e.startedAt||Date.now()).toISOString(),a=(e.points||[]).map(s=>{const i=Number.isFinite(s.altitude)?`<ele>${s.altitude.toFixed(1)}</ele>`:"",o=s.ts?`<time>${new Date(s.ts).toISOString()}</time>`:"";return`      <trkpt lat="${s.lat.toFixed(6)}" lon="${s.lon.toFixed(6)}">${i}${o}</trkpt>`}).join(`
`);return`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mossy Dawn / 晓山青" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${t}</name>
    <time>${n}</time>
  </metadata>
  <trk>
    <name>${t}</name>
    <trkseg>
${a}
    </trkseg>
  </trk>
</gpx>`}function es(e){return String(e).replace(/[<>&'"]/g,t=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"})[t])}let O=null;function ns(){const e=D(),t=[],n=160,a=Date.now()-3.2*36e5;for(let s=0;s<n;s++){const i=s/n,o=i*Math.PI*2.2,r=.012*(1-i*.35);t.push({lat:e.lat+Math.cos(o)*r+Math.sin(i*9)*.0012,lon:e.lon+Math.sin(o)*r*.9,altitude:e.elevation*.35+e.elevation*.6*Math.sin(Math.min(1,i*1.25)*Math.PI)+Math.sin(i*30)*6,accuracy:8,ts:a+s*72e3})}return t}const as={id:"trail",title:"轨迹",icon:"footprint",template(){return`
      <div class="page-head">
        <div>
          <h1 class="page-head__title">轨迹</h1>
          <p class="page-head__desc">GPS 记录 · 后台计算 · 可导出 GPX</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="card" title="生成光之卡片">${x("sparkles",19)}</button>
          <button class="icon-btn" type="button" data-action="export" title="导出 GPX">${x("download",19)}</button>
        </div>
      </div>

      <div class="trail-map" id="trailMapWrap">
        <canvas id="trailCanvas"></canvas>
        <div class="team-map__tools">
          <button class="map-tool" type="button" data-action="zoom-in" title="放大">${x("zoomIn",16)}</button>
          <button class="map-tool" type="button" data-action="zoom-out" title="缩小">${x("zoomOut",16)}</button>
          <button class="map-tool" type="button" data-action="fit" title="适配范围">${x("expand",16)}</button>
        </div>
        <div class="map-empty" id="trailEmpty">
          <div class="map-empty__card">
            ${x("map",26)}
            <div>还没有轨迹数据<br />点下方「开始记录」，或先载入示例</div>
          </div>
        </div>
        <div class="trail-map__overlay">
          <span class="trail-map__badge is-idle" id="trailState"><span class="dot"></span>待机</span>
          <span class="trail-map__badge" id="trailPointCount">0 个点</span>
        </div>
      </div>

      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><div class="stat__label">距离</div><div class="stat__value" id="stDistance">0.00<small>km</small></div></div>
        <div class="stat"><div class="stat__label">累计爬升</div><div class="stat__value" id="stGain">0<small>m</small></div></div>
        <div class="stat"><div class="stat__label">用时</div><div class="stat__value" id="stTime">00:00</div></div>
        <div class="stat"><div class="stat__label">平均配速</div><div class="stat__value" id="stPace">--</div></div>
      </div>

      <div class="trail-controls">
        <button class="trail-record" type="button" id="recordBtn">${x("play",17)} 开始记录</button>
        <button class="btn btn--icon btn--ghost" type="button" data-action="pause" id="pauseBtn" style="display:none" title="暂停">${x("pause",17)}</button>
      </div>

      <div class="trail-profile" style="margin-top:14px">
        <canvas id="trailProfile"></canvas>
        <div class="trail-profile__label">
          <span id="profileMin">--</span>
          <span>海拔剖面</span>
          <span id="profileMax">--</span>
        </div>
      </div>

      <section class="section" style="margin-top:22px">
        <div class="section__head">
          <div>
            <h2 class="section__title">历史记录</h2>
            <p class="section__desc">存在本机 IndexedDB，不上传云端</p>
          </div>
          <button class="btn btn--sm btn--ghost" type="button" data-action="demo">载入示例</button>
        </div>
        <div class="stack" id="trailHistory">
          <div class="loading-inline"><span class="spinner"></span>读取中…</div>
        </div>
      </section>
    `},async mount(e,t){const n=v=>e.querySelector(v),a=n("#trailCanvas"),s=new Ja(a,{onViewChange:()=>{}});s.setView({lat:D().lat,lon:D().lon,zoom:14}),s.setMarkers([]);const i=n("#trailProfile");let o=[],r=[],c=[],u=null,p=null;const f=()=>{const v=Math.min(window.devicePixelRatio||1,2),b=Math.max(80,i.clientWidth||i.parentElement.clientWidth-28),S=74;i.width=Math.max(1,b*v),i.height=S*v;const g=i.getContext("2d");if(g.setTransform(v,0,0,v,0,0),g.clearRect(0,0,b,S),!r.length){g.strokeStyle="rgba(125,143,131,0.4)",g.setLineDash([3,4]),g.beginPath(),g.moveTo(0,S/2),g.lineTo(b,S/2),g.stroke(),g.setLineDash([]),n("#profileMin").textContent="--",n("#profileMax").textContent="--";return}const M=Math.min(...r),w=Math.max(...r),$=Math.max(1,w-M),C=b/Math.max(1,r.length-1),N=ut=>S-8-(ut-M)/$*(S-22),F=g.createLinearGradient(0,0,0,S);F.addColorStop(0,"rgba(229,164,87,0.34)"),F.addColorStop(1,"rgba(229,164,87,0.02)"),g.beginPath(),g.moveTo(0,S),r.forEach((ut,Mt)=>g.lineTo(Mt*C,N(ut))),g.lineTo(b,S),g.closePath(),g.fillStyle=F,g.fill(),g.beginPath(),r.forEach((ut,Mt)=>{const me=Mt*C,fe=N(ut);Mt===0?g.moveTo(me,fe):g.lineTo(me,fe)}),g.strokeStyle="#e5a457",g.lineWidth=1.8,g.lineJoin="round",g.stroke(),n("#profileMin").textContent=`${Math.round(M)} m`,n("#profileMax").textContent=`${Math.round(w)} m`},l=v=>{v&&(u=v,n("#stDistance").innerHTML=`${(v.distanceKm||0).toFixed(2)}<small>km</small>`,n("#stGain").innerHTML=`${v.elevation?.gain||0}<small>m</small>`,n("#stTime").textContent=ia(v.duration||0),n("#stPace").innerHTML=v.avgPace?`${Math.floor(v.avgPace/6e4)}'${String(Math.floor(v.avgPace%6e4/1e3)).padStart(2,"0")}"<small>/km</small>`:"--")},h=v=>{const b=n("#trailState");v.running?(b.classList.remove("is-idle"),b.innerHTML=`<span class="dot"></span>${v.paused?"已暂停":"记录中"}`):(b.classList.add("is-idle"),b.innerHTML='<span class="dot"></span>待机'),n("#trailPointCount").textContent=`${v.pointCount||0} 个点`},d=(v,b)=>{o=b,r=v.profile||[];const S=v.simplified||b;s.setPath(S),s.setMarkers(S.length>1?[{id:"peak",lat:D().lat,lon:D().lon,label:D().name,color:"#8dbf9e",kind:"peak"}]:[]),n("#trailEmpty")?.classList.toggle("hidden",S.length>1),l(v),f()};O?(O.onUpdate=d,O.onStatus=v=>h(v)):O=new ts({onUpdate:d,onStatus:v=>{h(v);const b=n("#recordBtn"),S=n("#pauseBtn");v.running?(b.classList.add("is-recording"),b.innerHTML=`${x("square",16)} 结束并保存`,S.style.display=v.paused?"none":"grid",v.paused&&(b.innerHTML=`${x("play",16)} 继续记录`)):(b.classList.remove("is-recording"),b.innerHTML=`${x("play",17)} 开始记录`,S.style.display="none")},onError:v=>V(v.message||"定位失败")});const m=async()=>{if(!navigator.geolocation){V("当前环境不支持定位");return}try{s.setPath([]),r=[],f(),await O.start(),I("开始记录，请保持应用在前台以获得更准的轨迹"),s.fitBounds([{lat:D().lat,lon:D().lon}])}catch(v){V(v.message)}},_=async()=>{const v=await O.stop(),b=v?.stats;if(!b||(b.distance||0)<5){X("轨迹太短，未保存"),O.discard();return}const S=await xn({title:"保存轨迹",desc:`共 ${ce(b.distance)}，累计爬升 ${b.elevation?.gain||0} m`,fields:[{name:"name",label:"轨迹名称",value:`${D().name} · ${new Date().getMonth()+1}/${new Date().getDate()}`,required:!0},{name:"note",label:"备注（可选）",type:"textarea",placeholder:"路况、天气、同行的人…"}],submitText:"保存"});if(!S){O.discard();return}await _t.save({name:S.name,note:S.note,points:v.points,stats:b,startedAt:v.startedAt,endedAt:v.endedAt}),I("已保存到本机"),O.discard(),y()},y=async()=>{c=await _t.list();const v=n("#trailHistory");if(!c.length){v.innerHTML=`<div class="card"><div class="empty">
          ${x("footprint",34)}
          <div class="empty__title">还没有轨迹</div>
          <div class="empty__desc">点上方「开始记录」实时采集，或载入示例查看效果</div>
        </div></div>`;return}v.innerHTML=c.map(b=>{const S=b.stats||{};return`<div class="card" style="padding:12px">
            <div class="row row--between" style="align-items:flex-start">
              <div class="grow">
                <div style="font-size:14px;font-weight:600">${L(b.name)}</div>
                <div class="trail-item__meta">
                  <span>${vt(b.startedAt)}</span>
                  <span>${(S.distanceKm||0).toFixed(2)} km</span>
                  <span>爬升 ${S.elevation?.gain||0} m</span>
                  <span>${oa((b.endedAt||0)-(b.startedAt||0))}</span>
                </div>
              </div>
              <div class="row" style="gap:2px">
                <button class="icon-btn" type="button" data-preview="${b.id}" title="查看">${x("map",17)}</button>
                <button class="icon-btn" type="button" data-gpx="${b.id}" title="导出 GPX">${x("download",17)}</button>
                <button class="icon-btn" type="button" data-share="${b.id}" title="分享">${x("share",17)}</button>
                <button class="icon-btn" type="button" data-del="${b.id}" title="删除">${x("trash",17)}</button>
              </div>
            </div>
          </div>`}).join("")},k=v=>{const b=D(),S=v.startedAt||Date.now(),M=new Date(S).getHours()<9?"dawn":"hike",w=Aa({trail:v,weather:A.weather,mountain:b,mode:M}),$=on({narrative:w,mode:"hike",sourceLabel:A.weather?.source==="live"?"实时天气":"演示天气"}),C=`晓山青-${v.startedAt?vt(v.startedAt):"轨迹"}.png`;Ot({title:"光之卡片",desc:"时间、坐标、海拔、当时的天气，都在这张图上",wide:!0,body:'<div class="card-preview"><canvas id="trailCardCanvas"></canvas></div>',actions:[{label:"分享",variant:"primary",close:!1,onClick:async()=>{await cn($,{title:"晓山青",text:w.headline})||(await Ht($,C),I("已保存图片"))}},{label:"保存图片",close:!1,onClick:async()=>{await Ht($,C),I("已保存图片")}}],onMount:N=>{const F=N.querySelector("#trailCardCanvas");F&&(F.width=$.width,F.height=$.height,F.getContext("2d").drawImage($,0,0))}})};e.addEventListener("click",async v=>{const b=v.target.closest("[data-action], [data-preview], [data-gpx], [data-share], [data-del]");if(!b||b.id==="recordBtn")return;const S=b.dataset.action;if(S==="zoom-in"&&s.zoomBy(1),S==="zoom-out"&&s.zoomBy(-1),S==="fit"&&s.fitBounds(o.length?o:[{lat:D().lat,lon:D().lon}]),S==="pause"&&(O.paused?O.resume():O.pause()),S==="export"){if(!o.length){X("当前没有可导出的轨迹");return}de(`track-${Date.now()}.gpx`,Ie({name:"晓山青轨迹",points:o,startedAt:o[0]?.ts}),"application/gpx+xml"),I("GPX 已导出")}if(S==="card"){if(!o.length){X("还没有轨迹可以生成卡片");return}k(p||{name:`${D().name} 轨迹`,startedAt:o[0]?.ts||Date.now(),endedAt:o[o.length-1]?.ts||Date.now(),points:o,stats:u||{}})}if(S==="demo"){const C=ns(),N=await new Promise(F=>{O.worker.analyze(C).then(F).catch(()=>F(null))});if(!N){V("示例计算失败");return}o=C,r=N.profile||[],s.setPath(N.simplified||C),s.fitBounds(C),l(N),f(),n("#trailState").innerHTML='<span class="dot"></span>示例轨迹',n("#trailPointCount").textContent=`${N.pointCount} 个点`,I("已载入示例轨迹（不会保存）")}const g=b.dataset.preview;if(g){const C=c.find(N=>N.id===g);if(!C)return;p=C,o=C.points||[],r=C.stats?.profile||[],s.setPath(C.stats?.simplified||C.points||[]),s.fitBounds(C.points||[]),l(C.stats),f(),window.scrollTo({top:0,behavior:"smooth"})}const M=b.dataset.gpx;if(M){const C=c.find(N=>N.id===M);de(`${C.name||"trail"}.gpx`,Ie(C),"application/gpx+xml"),I("GPX 已导出")}const w=b.dataset.share;if(w){const C=c.find(N=>N.id===w);C&&k(C)}const $=b.dataset.del;$&&await ne({title:"删除这条轨迹？",desc:"删除后不可恢复，导出的 GPX 文件不受影响。",confirmText:"删除",danger:!0})&&(await _t.remove($),I("已删除"),y())}),n("#recordBtn").addEventListener("click",async()=>{O.isRunning?O.paused?O.resume():await _():await m()});const P=new ResizeObserver(()=>f());P.observe(i.parentElement);const T=H.on("trail:change",y);if(await y(),c.length){const v=c[0];p=v,o=v.points||[],r=v.stats?.profile||[],s.setPath(v.stats?.simplified||v.points||[]),s.fitBounds(v.points||[]),l(v.stats),f(),n("#trailState").innerHTML=`<span class="dot"></span>${v.name}`}return f(),()=>{T(),P.disconnect(),s.destroy()}}},ss="modulepreload",is=function(e,t){return new URL(e,t).href},He={},os=function(t,n,a){let s=Promise.resolve();if(n&&n.length>0){let o=function(p){return Promise.all(p.map(f=>Promise.resolve(f).then(l=>({status:"fulfilled",value:l}),l=>({status:"rejected",reason:l}))))};const r=document.getElementsByTagName("link"),c=document.querySelector("meta[property=csp-nonce]"),u=c?.nonce||c?.getAttribute("nonce");s=o(n.map(p=>{if(p=is(p,a),p in He)return;He[p]=!0;const f=p.endsWith(".css"),l=f?'[rel="stylesheet"]':"";if(!!a)for(let m=r.length-1;m>=0;m--){const _=r[m];if(_.href===p&&(!f||_.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${p}"]${l}`))return;const d=document.createElement("link");if(d.rel=f?"stylesheet":ss,f||(d.as="script"),d.crossOrigin="",d.href=p,u&&d.setAttribute("nonce",u),document.head.appendChild(d),f)return new Promise((m,_)=>{d.addEventListener("load",m),d.addEventListener("error",()=>_(new Error(`Unable to preload CSS for ${p}`)))})}))}function i(o){const r=new Event("vite:preloadError",{cancelable:!0});if(r.payload=o,window.dispatchEvent(r),!r.defaultPrevented)throw o}return s.then(o=>{for(const r of o||[])r.status==="rejected"&&i(r.reason);return t().catch(i)})};function rs(){const e=navigator.userAgent;return/Electron/i.test(e)?"Windows 桌面版（Electron）":/Android/i.test(e)?"Android":/iPhone|iPad/i.test(e)?"iOS":/Macintosh/i.test(e)?"macOS":"浏览器 / PWA"}const cs={id:"settings",title:"设置",icon:"settings",template(){const e=G.all;return`
      <div class="page-head">
        <div>
          <h1 class="page-head__title">设置</h1>
          <p class="page-head__desc">当前数据来源：${G.hasQWeather()?"实时预报":"演示数据"}</p>
        </div>
      </div>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">和风天气 · 把演示数据换成真实预报</div>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Key</span>
            <input class="input" id="qwKey" type="password" placeholder="粘贴你的和风天气 Key" value="${L(e.qweather.key||"")}" />
          </label>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Host</span>
            <input class="input" id="qwHost" type="text" placeholder="https://xxxxxxxx.re.qweatherapi.com" value="${L(e.qweather.host||"")}" />
            <span class="field__hint">免费版必须填控制台分配的专属 Host；不确定可先保持 devapi.qweather.com。</span>
          </label>
          <div class="row" style="gap:8px">
            <button class="btn btn--sm btn--primary" type="button" data-action="test-weather">${x("activity",14)} 测试连接</button>
            <button class="btn btn--sm btn--ghost" type="button" data-action="open-qw">申请地址</button>
          </div>
          <p class="field__hint" style="margin-top:12px">
            前端 Key 一定会被扒出来。上线前请在和风控制台设置域名白名单并开启用量告警，
            或把请求转发到你自己的服务端。
          </p>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">模型校准</div>
          <button class="list-row" type="button" data-action="feedback">
            <span class="list-row__icon">${x("sparkles",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">我的反馈样本</span>
              <span class="list-row__sub" id="fbSub">读取中…</span>
            </span>
            <span class="list-row__tail" id="fbCount">--</span>
          </button>
          <button class="list-row" type="button" data-action="reset-calib">
            <span class="list-row__icon">${x("refresh",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">重置校准</span>
              <span class="list-row__sub">样本只留在本机，重置后概率回到未经校准的模型输出</span>
            </span>
            <span class="list-row__tail">${x("chevronRight",15)}</span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">外观</div>
          <div class="setting-row" style="border-bottom:none">
            <div class="setting-row__main">
              <div class="setting-row__title">主题</div>
              <div class="setting-row__desc" id="themeDesc">${et.label()}</div>
            </div>
            <div class="segmented" id="themeSeg">
              ${["auto","light","dark"].map(n=>`<button type="button" data-theme-set="${n}" class="${et.mode===n?"is-active":""}">${{auto:"自动",light:"浅色",dark:"深色"}[n]}</button>`).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">数据</div>
          <button class="list-row" type="button" data-action="export-data">
            <span class="list-row__icon">${x("download",18)}</span>
            <span class="list-row__main"><span class="list-row__title">导出全部数据</span><span class="list-row__sub">轨迹、追光反馈、偏好（JSON）</span></span>
            <span class="list-row__tail">${x("chevronRight",15)}</span>
          </button>
          <button class="list-row" type="button" data-action="install">
            <span class="list-row__icon">${x("expand",18)}</span>
            <span class="list-row__main"><span class="list-row__title">安装到本机</span><span class="list-row__sub">PWA：添加到主屏幕 / 桌面</span></span>
            <span class="list-row__tail" id="installState">检查中</span>
          </button>
          <button class="list-row" type="button" data-action="clear">
            <span class="list-row__icon" style="color:var(--danger)">${x("trash",18)}</span>
            <span class="list-row__main"><span class="list-row__title" style="color:var(--danger)">清除全部数据</span><span class="list-row__sub">不可恢复，请先导出备份</span></span>
            <span class="list-row__tail">${x("chevronRight",15)}</span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="card" style="text-align:center;padding:26px 20px">
          <div style="display:flex;justify-content:center;margin-bottom:10px">${qe(52)}</div>
          <div style="font-family:var(--font-display);font-size:20px;letter-spacing:.16em">晓山青</div>
          <div class="muted" style="font-size:11px;letter-spacing:.2em;margin-top:4px">VIRIDIORE</div>
          <div class="muted" style="font-size:12px;margin-top:14px">版本 v2.1.0 · ${rs()}</div>
          <div class="muted" style="font-size:11px;margin-top:6px">不问天气好不好，只回答值不值得去</div>
        </div>
      </section>

      <p class="center muted" style="font-size:11px;padding:6px 0 10px">
        无痕山林 · 只带走照片，只留下脚印
      </p>
    `},async mount(e){const t=o=>e.querySelector(o),n=()=>{G.set({qweather:{key:t("#qwKey").value.trim(),host:t("#qwHost").value.trim()||"https://devapi.qweather.com"}}),H.emit("config:change",G.all)};e.querySelectorAll("input").forEach(o=>{o.addEventListener("change",()=>{n(),o.style.borderColor="var(--moss-400)",setTimeout(()=>o.style.borderColor="",700)})});const a=async()=>{const{total:o}=await Vt();t("#fbCount").textContent=`${o} 条`,t("#fbSub").textContent=o<3?`已有 ${o} 条，满 3 条开始参与概率校准`:`已有 ${o} 条，已参与概率校准`};e.addEventListener("click",async o=>{const r=o.target.closest("[data-theme-set]");if(r){et.set(r.dataset.themeSet),e.querySelectorAll("[data-theme-set]").forEach(u=>u.classList.toggle("is-active",u===r)),t("#themeDesc").textContent=et.label();return}const c=o.target.closest("[data-action]");if(c)switch(c.dataset.action){case"test-weather":{if(n(),!G.hasQWeather()){X("请先填写 API Key");return}const u=c;u.disabled=!0,u.innerHTML='<span class="spinner"></span> 测试中';try{const p=await tt.now(114.0579,22.5431);I(`连接成功：深圳 ${p.now.temp}℃ ${p.now.text}`),lt(!0).catch(()=>{})}catch(p){V(`连接失败：${p.message}`)}finally{u.disabled=!1,u.innerHTML=`${x("activity",14)} 测试连接`}break}case"open-qw":window.open("https://console.qweather.com/","_blank","noopener");break;case"feedback":{const{rows:u}=await Vt();if(!u.length){X("还没有反馈样本。到追光页点「看到了 / 白跑一趟」");return}I(`共 ${u.length} 条样本，最近一条预测 ${u[u.length-1].predicted}%`);break}case"reset-calib":{if(await ne({title:"重置校准？",desc:"会清空所有追光反馈样本，概率回到未经校准的模型输出。轨迹不受影响。",confirmText:"重置",danger:!0})){const{idb:p}=await os(async()=>{const{idb:f}=await Promise.resolve().then(()=>pn);return{idb:f}},void 0,import.meta.url);await p.clear("feedback").catch(()=>{}),ya(),a(),I("已重置")}break}case"export-data":{const[u,p]=await Promise.all([_t.list(),Vt()]);de(`xiaoshanqing-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({exportedAt:new Date().toISOString(),version:"2.1.0",trails:u,feedback:p.rows,prefs:J.all},null,2),"application/json"),I("已导出 JSON 备份");break}case"install":{if(window.__installPrompt){window.__installPrompt.prompt();const u=await window.__installPrompt.userChoice;window.__installPrompt=null,t("#installState").textContent=u.outcome==="accepted"?"已发起安装":"已取消"}else window.matchMedia("(display-mode: standalone)").matches?I("已在独立窗口中运行"):X("当前浏览器未提供安装入口：iOS 请用 Safari「添加到主屏幕」");break}case"clear":{await ne({title:"清除全部数据？",desc:"轨迹、追光反馈、缓存都会删除，且无法恢复。",confirmText:"确认清除",danger:!0})&&(await vn(),I("已清除，正在重新加载"),setTimeout(()=>location.reload(),800));break}}});const s=t("#installState");s.textContent=window.__installPrompt?"可安装":window.matchMedia("(display-mode: standalone)").matches?"已安装":"不可用",a();const i=H.on("config:change",()=>{});return()=>i()}};[ja,Ya,as,Za,cs].forEach(Sn);function ls(){const e=document.getElementById("boot-splash");e&&(e.classList.add("is-hidden"),setTimeout(()=>e.remove(),600))}function ds(){!(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")||!("serviceWorker"in navigator)||window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(t=>console.warn("[sw] 注册失败",t))})}function us(){window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),window.__installPrompt=e})}async function hs(){et.init(),us();const e=document.getElementById("app"),t=aa(e);kn(t.pageRoot),lt().catch(n=>console.warn("[boot] 天气预取失败",n)),await Cn(t.pageRoot,"home"),ls(),ds(),window.addEventListener("unhandledrejection",n=>{console.warn("[unhandledrejection]",n.reason)})}window.addEventListener("error",e=>{console.error("[global error]",e.error||e.message)});hs().catch(e=>{console.error("[boot] 启动失败",e);const t=document.getElementById("boot-splash");t&&(t.innerHTML=`<div style="color:#fff;text-align:center;padding:24px">
    <div style="font-size:18px;margin-bottom:8px">应用启动失败</div>
    <div style="font-size:12px;opacity:.75;max-width:320px">${e.message}</div>
  </div>`),V("应用启动失败，请刷新重试")});
