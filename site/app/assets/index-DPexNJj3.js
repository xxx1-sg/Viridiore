(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&a(r)}).observe(document,{childList:!0,subtree:!0});function n(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=n(s);fetch(s.href,i)}})();const An="mossy-dawn",Dn=2,In={trails:{keyPath:"id",indexes:[["startedAt","startedAt"]]},roadbooks:{keyPath:"id",indexes:[["createdAt","createdAt"]]},gear:{keyPath:"id",indexes:[["group","group"]]},contacts:{keyPath:"id",indexes:[]},pressure:{keyPath:"id",indexes:[["ts","ts"]]},cache:{keyPath:"key",indexes:[["expireAt","expireAt"]]},feedback:{keyPath:"id",indexes:[["mountainId","mountainId"],["ts","ts"]]}};let zt=null;function Bt(){return zt||(zt=new Promise((e,t)=>{if(typeof indexedDB>"u"){t(new Error("当前环境不支持 IndexedDB"));return}const n=indexedDB.open(An,Dn);n.onupgradeneeded=()=>{const a=n.result;for(const[s,i]of Object.entries(In))if(!a.objectStoreNames.contains(s)){const r=a.createObjectStore(s,{keyPath:i.keyPath});for(const[o,c]of i.indexes)r.createIndex(o,c,{unique:!1})}},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)}),zt)}async function jt(e,t,n){const a=await Bt();return new Promise((s,i)=>{const r=a.transaction(e,t),o=r.objectStore(e);let c;try{c=n(o)}catch(u){i(u);return}r.oncomplete=()=>s(c&&c.__req?c.__req.result:c),r.onerror=()=>i(r.error),r.onabort=()=>i(r.error)})}const gt={async put(e,t){return await jt(e,"readwrite",n=>n.put(t)),t},async bulkPut(e,t){return await jt(e,"readwrite",n=>{t.forEach(a=>n.put(a))}),t},async get(e,t){const n=await Bt();return new Promise((a,s)=>{const i=n.transaction(e,"readonly").objectStore(e).get(t);i.onsuccess=()=>a(i.result||null),i.onerror=()=>s(i.error)})},async all(e){const t=await Bt();return new Promise((n,a)=>{const s=t.transaction(e,"readonly").objectStore(e).getAll();s.onsuccess=()=>n(s.result||[]),s.onerror=()=>a(s.error)})},async remove(e,t){await jt(e,"readwrite",n=>n.delete(t))},async clear(e){await jt(e,"readwrite",t=>t.clear())},async count(e){const t=await Bt();return new Promise((n,a)=>{const s=t.transaction(e,"readonly").objectStore(e).count();s.onsuccess=()=>n(s.result),s.onerror=()=>a(s.error)})}};async function Le(e){try{return await gt.all(e)}catch(t){return console.warn("[db] 读取失败",e,t),[]}}async function ne(e,t){try{return await gt.put(e,t)}catch(n){return console.warn("[db] 写入失败",e,n),null}}const Hn=Object.freeze(Object.defineProperty({__proto__:null,idb:gt,safeAll:Le,safePut:ne},Symbol.toStringTag,{value:"Module"})),On={},ie=On||{},Kt={qweather:{key:ie.VITE_QWEATHER_KEY||"",host:ie.VITE_QWEATHER_HOST||"https://devapi.qweather.com",geoHost:ie.VITE_QWEATHER_GEOHOST||"https://geoapi.qweather.com"},app:{version:"2.3.0",city:"深圳",location:{lat:22.5431,lon:114.0579,name:"深圳"}}},_e="mossy.config";function cn(){try{return JSON.parse(localStorage.getItem(_e)||"{}")}catch{return{}}}function It(e,t){const n=Array.isArray(e)?[...e]:{...e};if(!t||typeof t!="object")return n;for(const[a,s]of Object.entries(t))s==null||s===""||(s&&typeof s=="object"&&!Array.isArray(s)?n[a]=It(n[a]||{},s):n[a]=s);return n}let Mt=It(Kt,cn());const nt={get all(){return Mt},get(e,t){const n=e.split(".");let a=Mt;for(const s of n){if(a==null)return t;a=a[s]}return a===void 0||a===""?t:a},set(e){const t=It(cn(),e);return localStorage.setItem(_e,JSON.stringify(t)),Mt=It(Kt,t),Mt},reset(){localStorage.removeItem(_e),Mt=It(Kt,{})},hasQWeather(){const e=Mt.qweather.key;return!!e&&!/^YOUR_/.test(e)},weatherSource(){return this.hasQWeather()?"Open-Meteo + 和风天气":"Open-Meteo"}},He=Kt.app.location,Fn=(e="id")=>`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,Ct=new Map,B={on(e,t){return Ct.has(e)||Ct.set(e,new Set),Ct.get(e).add(t),()=>Ct.get(e)?.delete(t)},emit(e,t){Ct.get(e)?.forEach(n=>{try{n(t)}catch(a){console.warn("[bus]",e,a)}})}},ln="mossy.prefs",xe={theme:"auto",voice:!0,notifications:!1,autoRefresh:!0,units:"metric",lastPage:"home",onboarded:!1,homeCity:"深圳"};let st={...xe};try{st={...xe,...JSON.parse(localStorage.getItem(ln)||"{}")}}catch{st={...xe}}const ut={get all(){return{...st}},get(e,t){return st[e]===void 0?t:st[e]},set(e){return st={...st,...e},localStorage.setItem(ln,JSON.stringify(st)),B.emit("prefs:change",st),st}},Ht={async list(){return(await Le("trails")).sort((t,n)=>(n.startedAt||0)-(t.startedAt||0))},async save(e){const t={id:e.id||Fn("trail"),name:e.name||"未命名轨迹",points:e.points||[],stats:e.stats||{},startedAt:e.startedAt||Date.now(),endedAt:e.endedAt||Date.now(),note:e.note||""};return await ne("trails",t),B.emit("trail:change",t),t},async remove(e){await gt.remove("trails",e).catch(()=>{}),B.emit("trail:change",null)},async get(e){return gt.get("trails",e).catch(()=>null)}},Oe={async get(e){const t=await gt.get("cache",e).catch(()=>null);return!t||t.expireAt&&t.expireAt<Date.now()?null:t.value},async set(e,t,n=600){return await ne("cache",{key:e,value:t,expireAt:Date.now()+n*1e3}),t},async clear(){await gt.clear("cache").catch(()=>{})}};async function Rn(){for(const e of["trails","roadbooks","gear","contacts","pressure","feedback","cache"])await gt.clear(e).catch(()=>{});ut.set({onboarded:!0})}const dn=window.matchMedia("(prefers-color-scheme: dark)");let yt=ut.get("theme","auto");function un(e=yt){return e==="auto"?dn.matches?"dark":"light":e}function oe(){const e=un();document.documentElement.setAttribute("data-theme",e),document.documentElement.style.colorScheme=e;const t=document.querySelector('meta[name="theme-color"]:not([media])');t&&t.setAttribute("content",e==="dark"?"#0c1411":"#f5f2ea"),B.emit("theme:change",{mode:yt,theme:e})}const mt={init(){oe(),dn.addEventListener("change",()=>{yt==="auto"&&oe()})},get mode(){return yt},get theme(){return un()},set(e){yt=e,ut.set({theme:e}),oe()},cycle(){const e=["auto","light","dark"],t=e[(e.indexOf(yt)+1)%e.length];return this.set(t),t},label(e=yt){return{auto:"跟随系统",light:"浅色",dark:"深色"}[e]||"跟随系统"}},re={home:'<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',sunrise:'<path d="M12 2v6"/><path d="m8 6 4-4 4 4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',sunset:'<path d="M12 8V2"/><path d="m8 6 4 4 4-4"/><path d="M2 18h2M20 18h2M4.2 13.2l1.4 1.4M18.4 14.6l1.4-1.4"/><path d="M6 18a6 6 0 0 1 12 0"/><path d="M2 22h20"/>',moon:'<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',cloud:'<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 19Z"/>',cloudSun:'<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2"/><path d="M15 10a4 4 0 1 0-3.5 4"/><path d="M18 20a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 8 13.5 3.2 3.2 0 0 0 9 20Z"/>',cloudRain:'<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 19v2M12 18v3M16 19v2"/>',cloudSnow:'<path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 7 3.5 3.5 0 0 0 7 15Z"/><path d="M8 18h.01M12 21h.01M16 18h.01M9 21h.01M15 21h.01"/>',cloudStorm:'<path d="M17.5 14a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 6.5 3.5 3.5 0 0 0 7 14Z"/><path d="m13 11-3 5h4l-2 5"/>',fog:'<path d="M4 9h16M3 13h18M5 17h14M7 21h10"/>',wind:'<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h8"/>',droplet:'<path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z"/>',gauge:'<path d="M12 14 8.5 9.5"/><circle cx="12" cy="14" r="1"/><path d="M4 18a9 9 0 1 1 16 0"/>',thermometer:'<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',navigation:'<path d="m3 11 19-8-8 19-2.5-7.5Z"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',route:'<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6"/>',mountain:'<path d="m2 20 7-14 4 8 2.5-4L22 20Z"/><path d="m9 6 1.5 3"/>',tent:'<path d="M4 21 12 4l8 17"/><path d="M8 21l4-8 4 8"/><path d="M2 21h20"/>',backpack:'<path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M9 4V3a3 3 0 0 1 6 0v1"/><path d="M9 12h6M9 16h6"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.1a4 4 0 0 1 0 7.75"/>',shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',alert:'<path d="m12 3 9 16a1 1 0 0 1-.9 1.5H3.9A1 1 0 0 1 3 19Z"/><path d="M12 9v4M12 17h.01"/>',bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M2 13h2M20 13h2"/>',sparkles:'<path d="m12 3 1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9Z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',chevronRight:'<path d="m9 6 6 6-6 6"/>',chevronDown:'<path d="m6 9 6 6 6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m4 12 5 5L20 6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4h6v3"/>',download:'<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',phone:'<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 12l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 7.2 2 2 0 0 1 6.5 3Z"/>',message:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z"/>',send:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',play:'<path d="m7 4 13 8-13 8Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',square:'<rect x="6" y="6" width="12" height="12" rx="2"/>',crosshair:'<circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2"/>',zoomIn:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>',zoomOut:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',layers:'<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',wifiOff:'<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 3.2-2.1M19 12.9a10 10 0 0 0-2.4-1.7"/><path d="M2 8.8a15 15 0 0 1 5-2.6M22 8.8a15 15 0 0 0-6.4-2.7"/><path d="M12 20h.01"/>',battery:'<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 11v2M8 11v2"/>',lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',filter:'<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',star:'<path d="m12 3 2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.7l6.2-.8Z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',heart:'<path d="M12 20S3 14.5 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 14.5 12 20 12 20Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',spark:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',edit:'<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>',arrowDown:'<path d="M12 5v14M6 13l6 6 6-6"/>',minus:'<path d="M5 12h14"/>',grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',expand:'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/>',footprint:'<path d="M6 16c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S6 17 6 16Z"/><path d="M15 13c0-3 1-7 3-7s2 3 1 5-1 4-2.5 4S15 14 15 13Z"/>'},qn={weather:"cloudSun",ai:"bot",gear:"backpack",teammate:"users",roadbook:"route",trail:"footprint",sos:"alert",pressure:"gauge",chase:"sunrise",home:"home",settings:"settings"};function x(e,t=18,n=""){const a=re[e]||re[qn[e]]||re.info;return`<svg class="${n}" xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${a}</svg>`}function hn(e=34){return`<svg width="${e}" height="${e}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
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
  </svg>`}const zn=[{test:e=>e===100,kind:"sun",label:"晴"},{test:e=>e===150,kind:"moon",label:"晴"},{test:e=>e===151||e===152||e===153,kind:"cloud",label:"多云"},{test:e=>[101,102,103,151,152,153].includes(e),kind:"cloudSun",label:"多云"},{test:e=>e===104,kind:"cloud",label:"阴"},{test:e=>e>=200&&e<300,kind:"wind",label:"风"},{test:e=>e>=300&&e<400,kind:"cloudRain",label:"雨"},{test:e=>e>=400&&e<500,kind:"cloudSnow",label:"雪"},{test:e=>e>=500&&e<516,kind:"fog",label:"雾霾"},{test:e=>e>=302&&e<305,kind:"cloudStorm",label:"雷雨"}],jn={100:"晴",101:"多云",102:"少云",103:"晴间多云",104:"阴",150:"晴",153:"晴间多云",300:"阵雨",301:"强阵雨",302:"雷阵雨",303:"强雷阵雨",304:"雷阵雨伴冰雹",305:"小雨",306:"中雨",307:"大雨",308:"极端降雨",309:"毛毛雨",310:"暴雨",311:"大暴雨",312:"特大暴雨",313:"冻雨",314:"小到中雨",315:"中到大雨",316:"大到暴雨",317:"暴雨到大暴雨",318:"大暴雨到特大暴雨",399:"雨",400:"小雪",401:"中雪",402:"大雪",403:"暴雪",404:"雨夹雪",405:"雨雪天气",406:"阵雨夹雪",407:"阵雪",408:"小到中雪",409:"中到大雪",410:"大到暴雪",499:"雪",500:"薄雾",501:"雾",502:"霾",503:"扬沙",504:"浮尘",507:"沙尘暴",508:"强沙尘暴",509:"浓雾",510:"强浓雾",511:"中度霾",512:"重度霾",513:"严重霾",514:"大雾",515:"特强浓雾",900:"热",901:"冷",999:"未知"};function Ut(e,t=24){const n=Number(e),a=zn.find(s=>s.test(n));return x(a?a.kind:"cloud",t)}function Zt(e){return jn[Number(e)]||"未知"}function A(e){return String(e??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function Wn(e,t,{duration:n=700,decimals:a=0,suffix:s=""}={}){if(!e)return;const i=0,r=performance.now(),o=c=>{const u=Math.min(1,(c-r)/n),m=1-Math.pow(1-u,3),d=i+(t-i)*m;e.textContent=d.toFixed(a)+s,u<1&&requestAnimationFrame(o)};requestAnimationFrame(o)}const wt=[];function pn(e){document.body.style.overflow=e?"hidden":""}function mn(e,t){wt.push({layer:e,onClose:t}),pn(!0)}function fn(e){const t=wt.findIndex(n=>n.layer===e);t>=0&&wt.splice(t,1),wt.length||pn(!1)}document.addEventListener("keydown",e=>{if(e.key!=="Escape"||!wt.length)return;wt[wt.length-1].layer.__close?.()});function ae(e={}){const{title:t="",desc:n="",body:a="",actions:s=[],wide:i=!1,dismissible:r=!0,onMount:o}=e,c=document.activeElement,u=document.createElement("div");u.className="modal-layer",u.innerHTML=`
    <div class="modal ${i?"modal--wide":""}" role="dialog" aria-modal="true">
      ${t?`<h3 class="modal__title">${A(t)}</h3>`:""}
      ${n?`<p class="modal__desc">${n}</p>`:""}
      ${a?`<div class="modal__body">${a}</div>`:""}
      ${s.length?'<div class="modal__actions"></div>':""}
    </div>`;const m=u.querySelector(".modal"),d=u.querySelector(".modal__actions"),l=p=>{u.remove(),fn(u),c?.focus?.({preventScroll:!0}),e.onClose?.(p)};return u.__close=()=>{r&&l()},s.forEach(p=>{const h=document.createElement("button");h.type="button",h.className=`btn ${p.variant?`btn--${p.variant}`:"btn--ghost"}`,h.textContent=p.label,h.addEventListener("click",async()=>{p.onClick&&await p.onClick({close:l,modal:m})===!1||p.close!==!1&&l(p.value)}),d?.appendChild(h)}),u.addEventListener("click",p=>{p.target===u&&r&&l()}),document.body.appendChild(u),mn(u,l),o?.(m,l),requestAnimationFrame(()=>{m.querySelector("input, textarea, select, button")?.focus?.({preventScroll:!0})}),{close:l,el:m}}function $e(e={}){const{title:t="确认操作",desc:n="",confirmText:a="确定",cancelText:s="取消",danger:i=!1,iconName:r=i?"alert":"info"}=e;return new Promise(o=>{let c=!1;const u=d=>{c||(c=!0,o(d))};ae({title:t,body:n?`<p class="modal__desc" style="margin:0">${A(n)}</p>`:"",actions:[{label:s,variant:"ghost",onClick:()=>u(!1)},{label:a,variant:i?"danger":"primary",onClick:()=>u(!0)}],onClose:()=>u(!1)});const m=document.querySelector(".modal__title");m&&r&&m.insertAdjacentHTML("afterbegin",`<span style="color:var(--${i?"danger":"moss-500"});margin-right:6px;vertical-align:-2px;display:inline-block">${x(r,18)}</span>`)})}function Ee(e={}){const{title:t="",body:n="",onMount:a,dismissible:s=!0}=e,i=document.createElement("div");i.className="sheet-layer",i.innerHTML=`
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet__grip"></div>
      ${t?`<h3 class="sheet__title">${A(t)}</h3>`:""}
      <div class="sheet__body">${n}</div>
    </div>`;const r=i.querySelector(".sheet"),o=()=>{i.remove(),fn(i)};return i.__close=()=>{s&&o()},i.addEventListener("click",c=>{c.target===i&&s&&o()}),document.body.appendChild(i),mn(i,o),a?.(r,o),{close:o,el:r}}function Bn(e={}){const{title:t="",desc:n="",fields:a=[],submitText:s="保存",cancelText:i="取消",onSubmit:r}=e,o=`<div class="stack" style="gap:14px">${a.map(c=>`
    <label class="field">
      <span class="field__label">${A(c.label)}</span>
      ${c.type==="textarea"?`<textarea class="textarea" name="${c.name}" placeholder="${A(c.placeholder||"")}">${A(c.value||"")}</textarea>`:c.type==="select"?`<select class="select" name="${c.name}">${(c.options||[]).map(u=>`<option value="${A(u.value)}" ${u.value===c.value?"selected":""}>${A(u.label)}</option>`).join("")}</select>`:`<input class="input" name="${c.name}" type="${c.type||"text"}" value="${A(c.value||"")}" placeholder="${A(c.placeholder||"")}" ${c.required?"required":""} ${c.min!=null?`min="${c.min}"`:""} ${c.max!=null?`max="${c.max}"`:""} ${c.step?`step="${c.step}"`:""} />`}
      ${c.hint?`<span class="field__hint">${A(c.hint)}</span>`:""}
    </label>`).join("")}</div>`;return new Promise(c=>{let u=!1;const m=l=>{u||(u=!0,c(l))},{el:d}=ae({title:t,desc:n,body:o,actions:[{label:i,variant:"ghost",onClick:()=>m(null)},{label:s,variant:"primary",onClick:()=>{const l={};let p=!0;if(a.forEach(h=>{const f=d.querySelector(`[name="${h.name}"]`);if(!f)return;const b=f.value.trim();h.required&&!b&&(p=!1,f.style.borderColor="var(--danger)"),l[h.name]=h.type==="number"?Number(b):b}),!p)return!1;r&&r(l),m(l)}}],onClose:()=>m(null)})})}let ct=null;function Un(){return ct&&document.body.contains(ct)||(ct=document.createElement("div"),ct.className="toast-layer",ct.setAttribute("role","status"),ct.setAttribute("aria-live","polite"),document.body.appendChild(ct)),ct}const Zn={ok:"check",danger:"alert",warn:"alert",info:"info"};function Ae(e,t={}){const{type:n="info",duration:a=2400}=t,s=Un(),i=document.createElement("div");i.className=`toast toast--${n}`,i.innerHTML=`${x(Zn[n]||"info",15)}<span>${A(e)}</span>`,s.appendChild(i);const r=()=>{i.classList.add("is-out"),setTimeout(()=>i.remove(),260)},o=setTimeout(r,a);return i.addEventListener("click",()=>{clearTimeout(o),r()}),r}const W=(e,t)=>Ae(e,{...t,type:"ok"}),ot=(e,t)=>Ae(e,{...t,type:"warn"}),dt=(e,t)=>Ae(e,{...t,type:"danger"}),Ot=new Map;let se=null,Fe=null,ce=null,Re=null;function Gn(e){Ot.set(e.id,e)}function qe(){const e=(location.hash||"").replace(/^#\/?/,""),[t,...n]=e.split("?");return{id:t||"home",query:n.join("?")}}function Kn(e){se=e}function Yn(e){const t=document.createElement("section");return t.className="page",t.id=`page-${e.id}`,t.setAttribute("aria-label",e.title||e.id),t.innerHTML=e.template?e.template():"",se.appendChild(t),e.el=t,e.mounted=!1,t}async function Me(e,{replace:t=!1}={}){const n=Ot.get(e)||Ot.get("home");if(!n||e===Fe&&n.mounted)return;ce?.(),ce=null,[...se.children].forEach(s=>s.classList.remove("is-active"));const a=n.el||Yn(n);if(a.classList.add("is-active"),document.title=`${n.title} · 晓山青`,n.mounted)n.onShow?.(a);else{try{ce=await n.mount?.(a)||null}catch(s){console.error("[router] 页面挂载失败",e,s),a.innerHTML=`<div class="empty"><div class="empty__title">页面加载失败</div><div class="empty__desc">${s.message}</div></div>`}n.mounted=!0}Fe=n.id,ut.set({lastPage:n.id}),window.scrollTo({top:0,behavior:"instant"in window?"instant":"auto"}),B.emit("route:change",n.id),!t&&location.hash!==`#/${n.id}`&&history.replaceState(null,"",`#/${n.id}`)}function Dt(e,t){Ot.get(e)&&(location.hash===`#/${e}`?Me(e,t):location.hash=`#/${e}`)}function Vn(e,t="home"){se=e,window.addEventListener("hashchange",()=>{const{id:a}=qe();Me(a)});const{id:n}=qe();return Re=Me(Ot.has(n)?n:t),Re}const Xn=9e3;class kt extends Error{constructor(t,n){super(t),this.name="WeatherError",this.code=n}}function Qn(e,t,n){const a=new URL(e.replace(/\/$/,"")+t);return Object.entries(n).forEach(([s,i])=>{i!=null&&i!==""&&a.searchParams.set(s,i)}),a.toString()}async function pt(e,t,n){const a=nt.get("qweather.key");if(!a)throw new kt("未配置和风天气 Key","NO_KEY");const s=new AbortController,i=setTimeout(()=>s.abort(),Xn);try{const r=await fetch(Qn(e,t,{...n,key:a}),{signal:s.signal,headers:{Accept:"application/json"}});if(!r.ok)throw new kt(`接口返回 ${r.status}`,`HTTP_${r.status}`);const o=await r.json();if(String(o.code)!=="200")throw new kt(`和风天气返回 ${o.code}`,String(o.code));return o}catch(r){throw r.name==="AbortError"?new kt("请求超时","TIMEOUT"):r instanceof kt?r:new kt(r.message||"网络错误","NETWORK")}finally{clearTimeout(i)}}const bt=()=>nt.get("qweather.host","https://devapi.qweather.com"),Jn=()=>nt.get("qweather.geoHost","https://geoapi.qweather.com"),it={now:(e,t)=>pt(bt(),"/v7/weather/now",{location:`${e},${t}`,lang:"zh"}),hourly24:(e,t)=>pt(bt(),"/v7/weather/24h",{location:`${e},${t}`,lang:"zh"}),daily7:(e,t)=>pt(bt(),"/v7/weather/7d",{location:`${e},${t}`,lang:"zh"}),air:(e,t)=>pt(bt(),"/v7/air/now",{location:`${e},${t}`,lang:"zh"}),warnings:(e,t)=>pt(bt(),"/v7/warning/now",{location:`${e},${t}`,lang:"zh"}),indices:(e,t)=>pt(bt(),"/v7/indices/1d",{location:`${e},${t}`,type:"0",lang:"zh"}),sun:(e,t,n)=>pt(bt(),"/v7/astronomy/sun",{location:`${e},${t}`,date:n,lang:"zh"}),cityLookup:e=>pt(Jn(),"/v2/city/lookup",{location:e,number:8,lang:"zh"})},Yt=Math.PI/180,vn=180/Math.PI;function ta(e){const t=new Date(e.getFullYear(),0,0);return Math.floor((e-t)/864e5)}function gn(e){const t=ta(e),n=e.getHours()+e.getMinutes()/60,a=2*Math.PI/365*(t-1+(n-12)/24),s=229.18*(75e-6+.001868*Math.cos(a)-.032077*Math.sin(a)-.014615*Math.cos(2*a)-.040849*Math.sin(2*a)),i=.006918-.399912*Math.cos(a)+.070257*Math.sin(a)-.006758*Math.cos(2*a)+907e-6*Math.sin(2*a)-.002697*Math.cos(3*a)+.00148*Math.sin(3*a);return{eqtime:s,decl:i}}function le(e,t){const n=new Date(e);return n.setHours(0,0,0,0),n.setMinutes(Math.round(t)),n}function xt(e,t,n){const{eqtime:a,decl:s}=gn(e),i=t*Yt,r=90.833*Yt,o=Math.cos(r)/(Math.cos(i)*Math.cos(s))-Math.tan(i)*Math.tan(s);if(o>1)return{polar:"night",sunrise:null,sunset:null};if(o<-1)return{polar:"day",sunrise:null,sunset:null};const c=Math.acos(o)*vn,u=720-4*(n+c)-a,m=720-4*(n-c)-a,d=720-4*n-a,l=-e.getTimezoneOffset(),p=le(e,u+l),h=le(e,m+l),f=le(e,d+l);return{sunrise:p,sunset:h,solarNoon:f,dayLength:h-p,goldenHour:new Date(p.getTime()-25*6e4)}}function ke(e,t){const{decl:n}=gn(e),a=t*Yt,s=-.833*Yt,i=(Math.sin(n)-Math.sin(a)*Math.sin(s))/(Math.cos(a)*Math.cos(s));return Math.acos(Math.max(-1,Math.min(1,i)))*vn}const ea=[[22.5,"北"],[67.5,"东北"],[112.5,"东"],[157.5,"东南"],[202.5,"南"],[247.5,"西南"],[292.5,"西"],[337.5,"西北"],[360,"北"]];function na(e){const t=((Number(e)||0)%360+360)%360;for(const[n,a]of ea)if(t<n)return a;return"北"}function Gt(e){const t=na(e);return t==="东"?"东侧山脊":`${t}向坡面`}function bn(e=new Date){const t=29.530588853,n=Date.UTC(2e3,0,6,18,14);return((e.getTime()-n)/864e5%t+t)%t/t}function yn(e){return e<.033||e>.967?"新月":e<.216?"娥眉月":e<.283?"上弦月":e<.466?"盈凸月":e<.534?"满月":e<.716?"亏凸月":e<.783?"下弦月":"残月"}function wn(e){return(1-Math.cos(2*Math.PI*e))/2}const de=[[0,0,0,0,0,0,0],[50,50,40,50,2,100,35],[100,150,80,150,4,160,75],[150,475,180,250,14,215,115],[200,800,280,350,24,265,150],[300,1600,565,420,36,800,250],[400,2100,750,500,48,null,350],[500,2620,940,600,60,null,500]],aa=[{key:"pm25",col:6,name:"PM2.5",unit:"μg/m³"},{key:"pm10",col:3,name:"PM10",unit:"μg/m³"},{key:"o3",col:5,name:"O₃",unit:"μg/m³"},{key:"no2",col:2,name:"NO₂",unit:"μg/m³"},{key:"so2",col:1,name:"SO₂",unit:"μg/m³"},{key:"co",col:4,name:"CO",unit:"mg/m³"}];function sa(e,t){const n=Number(e);if(!Number.isFinite(n)||n<0)return null;for(let a=1;a<de.length;a++){const[s,...i]=de[a],[r,...o]=de[a-1],c=i[t-1],u=o[t-1];if(!(c===null||u===null)&&n<=c)return c===u?s:Math.round((s-r)/(c-u)*(n-u)+r)}return 500}function ia(e){const t=Number(e);return Number.isFinite(t)?t<=50?{level:1,label:"优",tone:"excellent"}:t<=100?{level:2,label:"良",tone:"good"}:t<=150?{level:3,label:"轻度污染",tone:"light"}:t<=200?{level:4,label:"中度污染",tone:"moderate"}:t<=300?{level:5,label:"重度污染",tone:"heavy"}:{level:6,label:"严重污染",tone:"severe"}:{level:0,label:"--",tone:"none"}}function oa(e={}){const t={pm25:e.pm25,pm10:e.pm10,so2:e.so2,no2:e.no2,o3:e.o3,co:Number.isFinite(Number(e.co))?Number(e.co)/1e3:void 0},n=[];for(const o of aa){const c=t[o.key];if(!Number.isFinite(Number(c)))continue;const u=sa(c,o.col);u!==null&&n.push({key:o.key,name:o.name,unit:o.unit,value:o.key==="co"?Number(Number(c).toFixed(2)):Math.round(Number(c)),iaqi:u})}if(!n.length)return null;const a=n.reduce((o,c)=>c.iaqi>o.iaqi?c:o),s=a.iaqi,i=ia(s),r=s>50?a.name:null;return n.sort((o,c)=>c.iaqi-o.iaqi),{aqi:s,category:i.label,level:i.level,tone:i.tone,primary:r,pollutants:n,standard:"CN MEE"}}const ra="https://api.open-meteo.com/v1/forecast",ca="https://air-quality-api.open-meteo.com/v1/air-quality",la=12e3,ze="Asia/Shanghai",da=["temperature_2m","relative_humidity_2m","dew_point_2m","apparent_temperature","precipitation","precipitation_probability","cloud_cover","cloud_cover_low","cloud_cover_mid","cloud_cover_high","visibility","wind_speed_10m","wind_direction_10m","wind_gusts_10m","pressure_msl","weather_code","uv_index","temperature_925hPa","relative_humidity_925hPa","geopotential_height_925hPa","temperature_850hPa","relative_humidity_850hPa","geopotential_height_850hPa","wind_speed_850hPa"],ua=["weather_code","temperature_2m_max","temperature_2m_min","sunrise","sunset","precipitation_sum","precipitation_probability_max","wind_speed_10m_max","wind_direction_10m_dominant","uv_index_max"],ha=["temperature_2m","relative_humidity_2m","dew_point_2m","apparent_temperature","is_day","precipitation","weather_code","cloud_cover","cloud_cover_low","pressure_msl","surface_pressure","wind_speed_10m","wind_direction_10m","wind_gusts_10m","visibility"];class Lt extends Error{constructor(t,n){super(t),this.name="MeteoError",this.code=n}}function Et(e){if(!e)return null;const t=String(e).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);return t?new Date(Number(t[1]),Number(t[2])-1,Number(t[3]),Number(t[4]),Number(t[5])):null}const Vt=e=>String(e).padStart(2,"0"),je=e=>e instanceof Date&&!Number.isNaN(e.getTime())?`${Vt(e.getHours())}:${Vt(e.getMinutes())}`:"--:--",pa=e=>`${e.getFullYear()}-${Vt(e.getMonth()+1)}-${Vt(e.getDate())}`;function j(e){const t=e.filter(n=>Number.isFinite(n));return t.length?t.reduce((n,a)=>n+a,0)/t.length:NaN}const P=(e,t=0)=>{const n=Number(e);return Number.isFinite(n)?Number(n.toFixed(t)):NaN},We=[.3,1.6,3.4,5.5,8,10.8,13.9,17.2,20.8,24.5,28.5,32.7];function ue(e){const t=Number(e);if(!Number.isFinite(t))return"--";let n=0;for(;n<We.length&&t>=We[n];)n+=1;return String(n)}const ma=["北风","东北风","东风","东南风","南风","西南风","西风","西北风"];function he(e){const t=Number(e);return Number.isFinite(t)?ma[Math.round((t%360+360)%360/45)%8]:"--"}const fa={0:100,1:102,2:103,3:104,45:501,48:509,51:309,53:309,55:305,56:313,57:313,61:305,63:306,65:307,66:313,67:313,71:400,73:401,75:402,77:499,80:300,81:301,82:307,85:407,86:409,95:302,96:304,99:304};function Wt(e,t=!1){const n=fa[Number(e)]??104;if(t){if(n===100)return 150;if(n===102)return 151;if(n===103)return 153}return n}async function Be(e,t){const n=new URL(e);Object.entries(t).forEach(([i,r])=>{r!=null&&r!==""&&n.searchParams.set(i,r)});const a=new AbortController,s=setTimeout(()=>a.abort(),la);try{const i=await fetch(n.toString(),{signal:a.signal,headers:{Accept:"application/json"}});if(!i.ok)throw new Lt(`天气接口返回 ${i.status}`,`HTTP_${i.status}`);const r=await i.json();if(r?.error)throw new Lt(r.reason||"天气接口返回错误","API_ERROR");return r}catch(i){throw i.name==="AbortError"?new Lt("天气接口超时，请检查网络后重试","TIMEOUT"):i instanceof Lt?i:new Lt(i.message||"网络不可达","NETWORK")}finally{clearTimeout(s)}}function va({temp:e,humidity:t,cloud:n,uv:a,precip:s,windScale:i}){const r=Number(s)>.2,o=Number(e)>=30,c=Number(i)>=6,u=r?{category:"不宜",text:"有降水，山路湿滑，建议改期或走铺装路线。"}:o?{category:"较不宜",text:"气温偏高，注意补水与避晒，建议清晨出发。"}:c?{category:"较不宜",text:"风力偏大，山脊线注意站稳。"}:{category:"适宜",text:"天气条件适合徒步，注意山顶温差。"},m=o?{category:"炎热",text:"短袖速干衣裤，带足饮水与防晒。"}:Number(e)>=22?{category:"舒适",text:"长袖速干衣，包里放一件薄外套。"}:Number(e)>=15?{category:"较凉",text:"建议抓绒 + 防风层，山顶风冷。"}:{category:"冷",text:"需要保暖层与防风外壳，注意失温。"},d=Number(a)>=8?"很强":Number(a)>=6?"强":Number(a)>=3?"中等":"弱",l=Number(a)>=6?`UV ${P(a,1)}，山顶紫外线比市区更强，防晒别省。`:`UV ${P(a,1)}，基础防晒即可。`;return[{type:"1",name:"运动指数",...u},{type:"2",name:"穿衣指数",...m},{type:"3",name:"紫外线",category:d,text:l},{type:"6",name:"旅游指数",category:r?"一般":"适宜",text:r?"降水会影响观景与路况。":"适合出行，留意山区天气变化。"},{type:"9",name:"过敏指数",category:Number(t)>80?"易发":"不易发",text:Number(t)>80?"湿度大，霉菌孢子活跃。":"过敏风险较低。"}]}async function ga(e,t,n="当前位置"){const[a,s]=await Promise.all([Be(ra,{latitude:Number(e).toFixed(4),longitude:Number(t).toFixed(4),current:ha.join(","),hourly:da.join(","),daily:ua.join(","),timezone:ze,forecast_days:7,wind_speed_unit:"ms",precipitation_unit:"mm"}),Be(ca,{latitude:Number(e).toFixed(4),longitude:Number(t).toFixed(4),current:"pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",timezone:ze,forecast_days:1}).catch(()=>null)]),i=a.hourly||{},r=a.daily||{},o=Number(a.elevation),c=(i.time||[]).map(Et),u=new Date,m=g=>(i[g]||[]).map(M=>Number.isFinite(M)?Number(M):NaN),d={temp:m("temperature_2m"),rh:m("relative_humidity_2m"),dew:m("dew_point_2m"),feels:m("apparent_temperature"),precip:m("precipitation"),pop:m("precipitation_probability"),cloud:m("cloud_cover"),cloudLow:m("cloud_cover_low"),cloudMid:m("cloud_cover_mid"),cloudHigh:m("cloud_cover_high"),vis:m("visibility"),wind:m("wind_speed_10m"),windDir:m("wind_direction_10m"),gust:m("wind_gusts_10m"),pressure:m("pressure_msl"),code:i.weather_code||[],uv:m("uv_index"),t925:m("temperature_925hPa"),rh925:m("relative_humidity_925hPa"),z925:m("geopotential_height_925hPa"),t850:m("temperature_850hPa"),rh850:m("relative_humidity_850hPa"),z850:m("geopotential_height_850hPa"),ws850:m("wind_speed_850hPa")},l=(g,M)=>Number.isFinite(g?.[M])?g[M]:NaN;let p=c.findIndex(g=>g&&g>=new Date(u.getTime()-30*6e4));p<0&&(p=0);const h=a.current||{},f=(g,M,I=0)=>{const E=Number(h[g]);if(Number.isFinite(E))return P(E,I);const F=Number(M);return Number.isFinite(F)?P(F,I):M},b=Number(h.is_day)===1;Number(h.pressure_msl);const v=l(d.pressure,p),N=p>=3?l(d.pressure,p-3):NaN,k=Number.isFinite(v)&&Number.isFinite(N)?P(v-N,1):null,L={temp:f("temperature_2m",l(d.temp,p)),feels:f("apparent_temperature",l(d.feels,p)),text:"",code:Wt(f("weather_code",l(d.code,p)),!b),humidity:f("relative_humidity_2m",l(d.rh,p)),windDir:he(f("wind_direction_10m",l(d.windDir,p))),windSpeed:String(f("wind_speed_10m",l(d.wind,p),1)),windScale:ue(f("wind_speed_10m",l(d.wind,p),1)),pressure:String(f("pressure_msl",l(d.pressure,p))),pressureStation:Number.isFinite(Number(h.surface_pressure))?String(P(h.surface_pressure)):null,pressureDelta:k,vis:String(P(f("visibility",l(d.vis,p))/1e3,1)),visMeters:f("visibility",l(d.vis,p)),cloud:String(f("cloud_cover",l(d.cloud,p))),dew:String(f("dew_point_2m",l(d.dew,p),1)),precip:String(f("precipitation",l(d.precip,p),1)),gust:String(f("wind_gusts_10m",l(d.gust,p),1)),isDay:b,observedAt:Et(h.time)||u},y=[];for(let g=p;g<Math.min(p+24,c.length);g++){const M=c[g];if(!M)continue;const I=M.getHours()<6||M.getHours()>=19,E=y.length===0;y.push({time:M,temp:E?L.temp:P(l(d.temp,g)),code:E?L.code:Wt(l(d.code,g),I),pop:P(l(d.pop,g)),windScale:E?Number(L.windScale)||0:Number(ue(l(d.wind,g)))||0,windSpeed:P(l(d.wind,g),1),windDir:he(l(d.windDir,g)),humidity:P(l(d.rh,g)),uv:P(l(d.uv,g),1),precip:P(l(d.precip,g),1)})}const $=[];(r.time||[]).map(g=>String(g).slice(0,10)).forEach((g,M)=>{const I=Et(r.sunrise?.[M]),E=Et(r.sunset?.[M]),F=[];c.forEach((tt,rt)=>{tt&&pa(tt)===g&&F.push(rt)});const at=I?F.filter(tt=>{const rt=c[tt];return rt>=new Date(I.getTime()-90*6e4)&&rt<=new Date(I.getTime()+30*6e4)}):F.slice(4,8),z=at.length?at:F.slice(4,8),ht=F.filter(tt=>c[tt].getHours()<=6||c[tt].getHours()>=20),R=(tt,rt)=>rt.map(En=>l(tt,En)),K={t2m:P(j(R(d.temp,z)),1),td2m:P(j(R(d.dew,z)),1),rh2m:P(j(R(d.rh,z)),0),cloudLow:P(j(R(d.cloudLow,z)),0),cloudMid:P(j(R(d.cloudMid,z)),0),cloudHigh:P(j(R(d.cloudHigh,z)),0),ws10:P(j(R(d.wind,z)),1),z925:P(j(R(d.z925,z)),0),t925:P(j(R(d.t925,z)),1),rh925:P(j(R(d.rh925,z)),0),z850:P(j(R(d.z850,z)),0),t850:P(j(R(d.t850,z)),1),rh850:P(j(R(d.rh850,z)),0),ws850:P(j(R(d.ws850,z)),1),nightCloud:P(j(R(d.cloud,ht)),0),nightWind:P(j(R(d.wind,ht)),1),stationElevation:P(o)},Rt=j(R(d.cloud,z)),O=j(R(d.vis,z)),Y=Number(r.uv_index_max?.[M]),Pt=Number(r.precipitation_probability_max?.[M]),qt=R(d.temp,F).filter(Number.isFinite),De=Number(r.temperature_2m_max?.[M]),Ie=Number(r.temperature_2m_min?.[M]);$.push({date:g,dateObj:new Date(`${g}T12:00:00`),max:Number.isFinite(De)?P(De):qt.length?P(Math.max(...qt)):null,min:Number.isFinite(Ie)?P(Ie):qt.length?P(Math.min(...qt)):null,tempNight:(()=>{const tt=(ht.length?R(d.temp,ht):[l(d.temp,F[0])]).filter(Number.isFinite);if(tt.length)return P(Math.min(...tt));const rt=Number(r.temperature_2m_min?.[M]);return Number.isFinite(rt)?P(rt):null})(),codeDay:Wt(r.weather_code?.[M],!1),textDay:"",codeNight:Wt(r.weather_code?.[M],!0),textNight:"",pop:Number.isFinite(Pt)?P(Pt):P(j(R(d.pop,F))),precip:String(P(r.precipitation_sum?.[M],1)),humidity:K.rh2m,windDir:he(r.wind_direction_10m_dominant?.[M]),windScale:ue(r.wind_speed_10m_max?.[M]),uv:Number.isFinite(Y)?P(Y,1):P(j(R(d.uv,F)),1),cloud:P(Rt),vis:P(O/1e3,1),sunrise:je(I),sunset:je(E),soundings:K})});let w=null;const C=s?.current;if(C){const g=oa({pm25:Number(C.pm2_5),pm10:Number(C.pm10),so2:Number(C.sulphur_dioxide),no2:Number(C.nitrogen_dioxide),co:Number(C.carbon_monoxide),o3:Number(C.ozone)});g&&(w={...g,observedAt:Et(C.time)||u})}const _=xt(u,e,t),S=bn(u);return{source:"live",provider:"open-meteo",providerName:"Open-Meteo",updatedAt:Date.now(),place:{name:n,lat:e,lon:t},elevation:o,now:{...L,text:""},hourly:y,daily:$,air:w,warnings:[],indices:va({temp:L.temp,humidity:L.humidity,cloud:L.cloud,uv:l(d.uv,p),precip:l(d.precip,p),windScale:L.windScale}),sun:{sunrise:_.sunrise,sunset:_.sunset,solarNoon:_.solarNoon,dayLength:_.dayLength},moon:{phase:S,phaseName:yn(S),illumination:wn(S)}}}function ba(e,t){const n=Math.max(1,Math.min(100,Number(t)||60)),a=Math.log(n/100)+17.62*e/(243.12+e);return 243.12*a/(17.62-a)}function ya(e,t){return Math.max(0,e-ba(e,t))}function wa(e,t){const n=Number(e),a=Number(t);return!Number.isFinite(n)||!Number.isFinite(a)?null:125*Math.max(0,n-a)}function pe(e,t,n,a){const s=(Number(a)-Number(t))/1e3;if(!Number.isFinite(s)||s<.05)return null;const i=Number(e)-Number(n);return Number.isFinite(i)?i/s:null}function _a(e={}){const t=Number(e.t2m),n=Number(e.z2m)||Number(e.stationElevation)||25,a=Number(e.t925),s=Number(e.z925),i=Number(e.t850),r=Number(e.z850),o=[],c=pe(t,n,a,s);c!==null&&o.push({lapse:c,top:s,tag:"925"});const u=pe(a,s,i,r);u!==null&&o.push({lapse:u,top:r,tag:"850"});const m=pe(t,n,i,r);if(m!==null&&o.push({lapse:m,top:r,tag:"all"}),!o.length)return{index:0,lapseLow:null,lapseMid:null,base:null,absolute:!1,label:"未知",note:"缺少高空层结数据",available:!1};const d=o.reduce((v,N)=>N.lapse<v.lapse?N:v),l=D((6.5-d.lapse)/9),p=d.lapse<0,h=d.lapse<0?"逆温":d.lapse<3?"强逆温倾向":d.lapse<5.5?"偏稳定":d.lapse<6.5?"接近中性":"不稳定",f=d.tag==="925"?"地面到 925 hPa":d.tag==="850"?"925—850 hPa":"地面到 850 hPa",b=d.lapse<0?`${f}温度随高度升高，逆温盖已经形成（${d.lapse.toFixed(1)} ℃/km）`:d.lapse<5.5?`${f}的直减率 ${d.lapse.toFixed(1)} ℃/km，低于标准大气 6.5，层结稳定`:`最稳定层（${f}）直减率 ${d.lapse.toFixed(1)} ℃/km，对流不易被压制`;return{index:l,lapseLow:c,lapseMid:u,lapse:d.lapse,layer:f,base:n,top:d.top,absolute:p,label:h,note:b,available:!0}}function Ue({dtr:e,cloudNight:t,windScale:n}){const a=D((e-4)/9),s=D((70-t)/50),i=D((5-n)/4);return D(.45*a+.3*s+.25*i)}function xa({precip:e,text:t="",code:n=0}){const a=Number(e)||0;if(a>=10)return 95;if(a>=3)return 82;if(a>=.5)return 65;const s=Number(n)||0;return s>=300&&s<=399?70:s>=400&&s<=499?60:/雨|雪|雷/.test(t)?55:/阴/.test(t)?28:/多云|晴间/.test(t)?12:4}const D=e=>{const t=Number(e);return Number.isFinite(t)?Math.max(0,Math.min(1,t)):0},Ft=(e,t,n)=>Math.max(t,Math.min(n,Number(e)||0)),$a=e=>1/(1+Math.exp(-Ft(e,-20,20))),Se=e=>{const t=Ft(e,.01,.99);return Math.log(t/(1-t))},Ma=600,U=(e,t=0)=>{const n=Number(e);return Number.isFinite(n)?Number(n.toFixed(t)):0};function ka(e,t,n,a){const{now:s,hourly:i,daily:r,air:o,warnings:c,indices:u}=a,m=xt(new Date,e,t),d=bn();return{source:"live",provider:"qweather",providerName:"和风天气",updatedAt:Date.now(),place:{name:n,lat:e,lon:t},now:{temp:U(s.temp),feels:U(s.feelsLike),text:s.text||Zt(s.icon),code:Number(s.icon),humidity:U(s.humidity),windDir:s.windDir||"--",windScale:String(s.windScale??"--"),windSpeed:String(s.windSpeed??"--"),pressure:String(s.pressure??"--"),pressureStation:null,pressureDelta:null,vis:String(s.vis??"--"),visMeters:Number.isFinite(Number(s.vis))?Number(s.vis)*1e3:NaN,cloud:String(s.cloud??"--"),dew:String(s.dew??"--"),precip:String(s.precip??"0.0"),gust:"--",isDay:!0,observedAt:new Date(s.obsTime||Date.now())},hourly:(i?.hourly||[]).slice(0,24).map(l=>({time:new Date(l.fxTime),temp:U(l.temp),code:Number(l.icon),text:l.text,pop:U(l.pop),windScale:Number(l.windScale),humidity:U(l.humidity)})),daily:(r?.daily||[]).map(l=>({date:l.fxDate,dateObj:new Date(`${l.fxDate}T12:00:00`),max:U(l.tempMax),min:U(l.tempMin),tempNight:U(l.tempMin),codeDay:Number(l.iconDay),textDay:l.textDay,codeNight:Number(l.iconNight),textNight:l.textNight,pop:xa({precip:l.precip,text:l.textDay,code:l.iconDay}),precip:String(l.precip??"0.0"),humidity:U(l.humidity),windDir:l.windDirDay,windScale:l.windScaleDay,uv:U(l.uvIndex),cloud:U(l.cloud),vis:U(l.vis),sunrise:l.sunrise,sunset:l.sunset,moonPhase:l.moonPhase})),air:o?{aqi:U(o.now?.aqi),category:o.now?.category||"--",level:String(o.now?.level||"1"),primary:o.now?.primary||"--",tone:"good",standard:"CN MEE",pollutants:[{key:"pm25",name:"PM2.5",unit:"μg/m³",value:U(o.now?.pm2p5),iaqi:null},{key:"pm10",name:"PM10",unit:"μg/m³",value:U(o.now?.pm10),iaqi:null}].filter(l=>Number.isFinite(l.value))}:null,warnings:(c?.warning||[]).map(l=>({id:l.id,title:l.title,type:l.type,typeName:l.typeName,level:l.level,severity:l.severity,severityColor:l.severityColor,pubTime:l.pubTime,startTime:l.startTime,endTime:l.endTime,sender:l.sender,text:l.text})),indices:(u?.daily||[]).map(l=>({type:l.type,name:l.name,category:l.category,text:l.text})),sun:{sunrise:m.sunrise,sunset:m.sunset,solarNoon:m.solarNoon,dayLength:m.dayLength},moon:{phase:d,phaseName:yn(d),illumination:wn(d)}}}async function Sa(e,t,n){if(!nt.hasQWeather()||!e)return e;const[a,s]=await Promise.allSettled([it.warnings(n,t),it.air(n,t)]);return a.status==="fulfilled"&&a.value?.warning?.length&&(e.warnings=a.value.warning.map(i=>({id:i.id,title:i.title,type:i.type,typeName:i.typeName,level:i.level,severity:i.severity,severityColor:i.severityColor,pubTime:i.pubTime,startTime:i.startTime,endTime:i.endTime,sender:i.sender,text:i.text,provider:"qweather"})),e.warningProvider="和风天气"),s.status==="fulfilled"&&s.value?.now?.aqi&&(e.air={aqi:U(s.value.now.aqi),category:s.value.now.category||"--",level:String(s.value.now.level||"1"),primary:s.value.now.primary||"--",tone:"good",standard:"CN MEE",pollutants:[{key:"pm25",name:"PM2.5",unit:"μg/m³",value:U(s.value.now.pm2p5),iaqi:null},{key:"pm10",name:"PM10",unit:"μg/m³",value:U(s.value.now.pm10),iaqi:null}].filter(i=>Number.isFinite(i.value))}),e}async function _n({lat:e,lon:t,name:n="当前位置",force:a=!1}={}){const s=`wx:${e.toFixed(3)}:${t.toFixed(3)}`;if(!a){const o=await Oe.get(s);if(o&&o.source==="live")return o}let i=null,r=null;try{i=await ga(e,t,n)}catch(o){r=o,console.warn("[weather] Open-Meteo 取数失败",o?.message||o)}if(!i&&nt.hasQWeather())try{const[o,c,u,m,d,l]=await Promise.allSettled([it.now(t,e),it.hourly24(t,e),it.daily7(t,e),it.air(t,e),it.warnings(t,e),it.indices(t,e)]);o.status==="fulfilled"&&(i=ka(e,t,n,{now:o.value.now,hourly:c.status==="fulfilled"?c.value:null,daily:u.status==="fulfilled"?u.value:null,air:m.status==="fulfilled"?m.value:null,warnings:d.status==="fulfilled"?d.value:null,indices:l.status==="fulfilled"?l.value:null}))}catch(o){console.warn("[weather] 和风兜底也失败",o?.message||o)}if(!i){const o=r?.code==="TIMEOUT"?"天气服务响应超时，请检查网络后重试":r?.code==="NETWORK"?"连不上天气服务，请检查网络或代理设置":r?.message||"天气数据获取失败";throw new Error(o)}return i=await Sa(i,e,t),i.now.text=i.now.text||Zt(i.now.code),i.daily=i.daily.map(o=>({...o,textDay:o.textDay||Zt(o.codeDay),textNight:o.textNight||Zt(o.codeNight)})),await Oe.set(s,i,Ma),i}async function Na(e){const t=e.trim();if(!t)return[];if(nt.hasQWeather())try{const n=await it.cityLookup(t);if(n?.location?.length)return n.location.map(a=>({name:a.name,lat:Number(a.lat),lon:Number(a.lon),admin:[a.adm1,a.adm2].filter(Boolean).join(" · ")}))}catch(n){console.warn("[weather] 城市搜索失败",n)}return[]}const $t=[{id:"wutong",name:"梧桐山",elevation:943,lat:22.581,lon:114.219,area:"罗湖 / 盐田",season:"10 月 — 次年 3 月",desc:"深圳第一峰，主峰大梧桐。云海与日出最经典，秋冬清晨湿度大时云海概率高。",tags:["云海","日出","深圳十峰"],difficulty:3,route:{distance:11.2,ascent:820,hours:5.5}},{id:"qiniang",name:"七娘山",elevation:869,lat:22.548,lon:114.561,area:"大鹏新区",season:"11 月 — 次年 4 月",desc:"深圳第二峰，三面环海，山脊视野极佳。坡度陡、以碎石路为主。",tags:["海景","日出","强度高"],difficulty:4,route:{distance:9.6,ascent:760,hours:6}},{id:"maluan",name:"马峦山",elevation:590,lat:22.629,lon:114.33,area:"坪山新区",season:"四季皆宜",desc:"瀑布群与百年梅花，路径成熟，适合轻装徒步和亲子出行。",tags:["瀑布","亲子","新手友好"],difficulty:2,route:{distance:8.4,ascent:420,hours:3.5}},{id:"paiya",name:"排牙山",elevation:707,lat:22.593,lon:114.487,area:"大鹏新区",season:"11 月 — 次年 3 月",desc:"锯齿状山脊，两侧临海，被称为深圳最险的穿越线路，需要手脚并用。",tags:["山脊","挑战","海景"],difficulty:5,route:{distance:12.8,ascent:880,hours:7}},{id:"meishajian",name:"梅沙尖",elevation:753,lat:22.607,lon:114.36,area:"盐田区",season:"10 月 — 次年 4 月",desc:"深圳第三高峰，山顶可俯瞰大小梅沙与盐田港，日出方向正对海平面。",tags:["日出","海景","深圳十峰"],difficulty:3,route:{distance:7.8,ascent:640,hours:4}},{id:"tanglang",name:"塘朗山",elevation:430,lat:22.586,lon:113.993,area:"南山区",season:"四季皆宜",desc:"城市绿肺，登山道完善，傍晚可看落日与城市灯光，通勤后夜爬首选。",tags:["城市","夜爬","新手友好"],difficulty:2,route:{distance:5.6,ascent:330,hours:2.5}},{id:"fenghuang",name:"凤凰山",elevation:376,lat:22.686,lon:113.846,area:"宝安区",season:"四季皆宜",desc:"古村、寺庙与森林并存，石阶路为主，适合半天轻徒步。",tags:["人文","轻徒步","新手友好"],difficulty:1,route:{distance:4.2,ascent:260,hours:2}},{id:"yangtaishan",name:"阳台山",elevation:587,lat:22.632,lon:113.988,area:"龙华 / 宝安",season:"10 月 — 次年 5 月",desc:"溪谷与瀑布众多，雨季水量充沛，注意湿滑与蚊虫。",tags:["溪谷","瀑布","避暑"],difficulty:2,route:{distance:7.1,ascent:480,hours:3.5}},{id:"dananshan",name:"大南山",elevation:336,lat:22.491,lon:113.913,area:"南山区",season:"四季皆宜",desc:"山顶可同时看到前海与蛇口港，日落与城市天际线是最大看点。",tags:["日落","城市","轻徒步"],difficulty:1,route:{distance:3.8,ascent:220,hours:1.8}},{id:"luofu",name:"罗浮山",elevation:1296,lat:23.268,lon:114.056,area:"惠州 · 博罗",season:"11 月 — 次年 4 月",desc:"岭南第一山，飞云顶云海概率高，适合两日重装或一日强穿。",tags:["云海","重装","外线"],difficulty:4,route:{distance:16.5,ascent:1100,hours:8}},{id:"nankun",name:"南昆山",elevation:1228,lat:23.635,lon:113.86,area:"惠州 · 龙门",season:"四季皆宜",desc:"北回归线上的森林氧吧，夏季避暑、秋季观星，车程约 2 小时。",tags:["森林","避暑","观星"],difficulty:3,route:{distance:10.2,ascent:700,hours:5}},{id:"yinhu",name:"银湖山",elevation:445,lat:22.586,lon:114.103,area:"罗湖 / 福田",season:"四季皆宜",desc:"市区内少见的连片山脊绿道，适合晨跑与短距越野训练。",tags:["越野跑","绿道","城市"],difficulty:2,route:{distance:6.4,ascent:380,hours:2.5}}],Ta=e=>$t.find(t=>t.id===e)||$t[0],_t=[{name:"深圳",lat:22.5431,lon:114.0579,group:"深圳"},{name:"福田区",lat:22.541,lon:114.055,group:"深圳"},{name:"罗湖区",lat:22.548,lon:114.131,group:"深圳"},{name:"南山区",lat:22.533,lon:113.93,group:"深圳"},{name:"盐田区",lat:22.557,lon:114.237,group:"深圳"},{name:"宝安区",lat:22.555,lon:113.883,group:"深圳"},{name:"龙岗区",lat:22.72,lon:114.246,group:"深圳"},{name:"龙华区",lat:22.696,lon:114.045,group:"深圳"},{name:"坪山区",lat:22.69,lon:114.346,group:"深圳"},{name:"光明区",lat:22.748,lon:113.936,group:"深圳"},{name:"大鹏新区",lat:22.596,lon:114.479,group:"深圳"},{name:"广州",lat:23.1291,lon:113.2644,group:"周边"},{name:"惠州",lat:23.1115,lon:114.4162,group:"周边"},{name:"东莞",lat:23.0207,lon:113.7518,group:"周边"},{name:"珠海",lat:22.2707,lon:113.5767,group:"周边"}],me=_t.find(e=>e.name===ut.get("homeCity","深圳"))||_t[0],H={location:{name:me.name,lat:me.lat??He.lat,lon:me.lon??He.lon},weather:null,weatherStatus:"idle",weatherError:"",mountainId:$t[0].id};let At=null;function q(){return Ta(H.mountainId)}function Ne(e){H.mountainId=e,ut.set({mountainId:e}),B.emit("mountain:change",e)}function Ze({name:e,lat:t,lon:n}){H.location={name:e,lat:t,lon:n},ut.set({homeCity:e}),H.weather=null,B.emit("location:change",H.location)}async function ft(e=!1){return H.weather&&!e?H.weather:(At&&!e||(H.weatherStatus="loading",B.emit("weather:status",H.weatherStatus),At=_n({lat:H.location.lat,lon:H.location.lon,name:H.location.name,force:e}).then(t=>(H.weather=t,H.weatherStatus="ready",H.weatherError="",B.emit("weather:change",t),B.emit("weather:status","ready"),t)).catch(t=>{throw H.weatherStatus="error",H.weatherError=t.message||"天气加载失败",B.emit("weather:status","error"),t}).finally(()=>{At=null})),At)}const fe=ut.get("mountainId");fe&&$t.some(e=>e.id===fe)&&(H.mountainId=fe);const Pa=[{id:"home",name:"首页",icon:"home",desc:"今天值不值得上山"},{id:"chase",name:"追光",icon:"sunrise",desc:"日出 · 云海 · 星空概率"},{id:"trail",name:"轨迹",icon:"footprint",desc:"GPS 记录与光之卡片"},{id:"weather",name:"天气",icon:"cloudSun",desc:"实时与七日预报"},{id:"settings",name:"设置",icon:"settings",desc:"数据源与偏好"}],Ge=Pa.filter(e=>e.id!=="settings"),Ca=e=>`<button class="topnav__item" type="button" data-nav="${e.id}">
    ${x(e.icon,16)}<span>${e.name}</span>
  </button>`,La=e=>`<button class="tabbar__item" type="button" data-nav="${e.id}">
    ${x(e.icon,21)}<span>${e.name}</span>
  </button>`;function Ea(){const e=H.weather;return e?.source==="live"?{text:e.providerName||"实时数据",tone:"live"}:navigator.onLine?{text:H.weatherStatus==="error"?"取数失败":"未连接",tone:"idle"}:{text:"离线",tone:"idle"}}function Aa(e){e.innerHTML=`
    <header class="topbar" id="topbar">
      <div class="topbar__inner">
        <button class="brand" type="button" data-nav="home" aria-label="返回首页">
          <span class="brand__mark">${hn(34)}</span>
          <span class="brand__text">
            <span class="brand__name">晓山青</span>
            <span class="brand__sub">Viridiore</span>
          </span>
        </button>

        <nav class="topnav" aria-label="主导航">
          ${Ge.map(Ca).join("")}
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
      ${Ge.map(La).join("")}
    </nav>
  `;const t=e.querySelector("#topbar"),n=e.querySelector("#netPill"),a=e.querySelector("#themeBtn"),s=e.querySelector("#page-root");e.addEventListener("click",c=>{const u=c.target.closest("[data-nav]");u&&Dt(u.dataset.nav)}),a.addEventListener("click",()=>{const c=mt.cycle(),u={auto:"跟随系统",light:"浅色模式",dark:"深色模式"}[c];W(`已切换为${u}`),i()});function i(){const c=mt.mode,u=c==="auto"?"sparkles":c==="dark"?"moon":"sun";a.innerHTML=x(u,19),a.title=`主题：${mt.label()}`}function r(){const{text:c,tone:u}=Ea();n.textContent=c,n.classList.toggle("is-offline",!navigator.onLine),n.classList.toggle("is-demo",u==="demo")}window.addEventListener("online",r),window.addEventListener("offline",r),B.on("weather:change",r),B.on("weather:status",r);const o=()=>t.classList.toggle("is-stuck",window.scrollY>4);return window.addEventListener("scroll",o,{passive:!0}),B.on("route:change",c=>{e.querySelectorAll("[data-nav]").forEach(u=>{u.classList.toggle("is-active",u.dataset.nav===c)})}),document.documentElement.addEventListener("theme:change",i),r(),i(),o(),{pageRoot:s}}const lt=e=>String(e).padStart(2,"0"),xn=["周日","周一","周二","周三","周四","周五","周六"];function Tt(e,t=!1){const n=new Date(e),a=`${n.getMonth()+1}月${n.getDate()}日`;return t?`${a} ${xn[n.getDay()]}`:a}function Z(e,t=!1){const n=new Date(e);return t?`${lt(n.getHours())}:${lt(n.getMinutes())}:${lt(n.getSeconds())}`:`${lt(n.getHours())}:${lt(n.getMinutes())}`}function Da(e){const t=Date.now()-e;return t<6e4?"刚刚":t<36e5?`${Math.floor(t/6e4)} 分钟前`:t<864e5?`${Math.floor(t/36e5)} 小时前`:t<7*864e5?`${Math.floor(t/864e5)} 天前`:Tt(e)}function Ia(e){const t=Math.max(0,Math.floor(e/1e3)),n=Math.floor(t/3600),a=Math.floor(t%3600/60),s=t%60;return n>0?`${n}:${lt(a)}:${lt(s)}`:`${lt(a)}:${lt(s)}`}function Ha(e){const t=Math.round(e/6e4);if(t<60)return`${t} 分钟`;const n=Math.floor(t/60),a=t%60;return a?`${n} 小时 ${a} 分`:`${n} 小时`}function Te(e){return Number.isFinite(e)?e<1e3?`${Math.round(e)} m`:`${(e/1e3).toFixed(2)} km`:"0 m"}const Oa=[.18,.2,.16,.1,.06,.03,.02,.02,.04,.09,.16,.19],Fa=[.52,.46,.4,.32,.26,.2,.22,.22,.28,.4,.48,.52],Ra=[.42,.36,.28,.2,.14,.1,.12,.12,.18,.3,.38,.42],et={cloudsea:{key:"cloudsea",name:"云海",icon:"cloud",desc:"在云上等太阳",prior:Oa,windowLabel:"日出前后 40 分钟"},sunrise:{key:"sunrise",name:"日出",icon:"sunrise",desc:"为了一抹晨光",prior:Fa,windowLabel:"日出前 30 分钟 — 日出后 20 分钟"},stars:{key:"stars",name:"星空",icon:"star",desc:"银河与星轨",prior:Ra,windowLabel:"天黑后 — 月出前"}};function qa(e){const t=e.soundings||{},n=Number(t.stationElevation)||25,a=Number.isFinite(Number(t.t2m))?Number(t.t2m):Number(e.min??e.tempNight??18),s=Number.isFinite(Number(t.td2m))?Number(t.td2m):a-ya(a,Number(e.humidity??70)),i=wa(a,s),r=n+(i??0),o=Math.max(0,a-s),c=Number.isFinite(Number(t.cloudLow))?Number(t.cloudLow):Number(e.cloud??50),u=Number.isFinite(Number(t.rh850))?Number(t.rh850):70,m=160+780*(.6*D(c/100)+.4*D((u-50)/50)),d=r+m;return{nightTemp:a,dewPoint:s,spread:o,lcl:i,base:r,thickness:m,top:d,cloudLow:c,rh850:u,hasLayer:c>25,believable:c>25&&r<3200}}const G=(e,t=NaN)=>{const n=Number(e);return Number.isFinite(n)?n:t};function Ke(e,t="cloudsea",n={}){const a=et[t]||et.cloudsea,s=n.mountain||{elevation:600},i=Number(s.elevation)||600,r=e.soundings||{},o=qa(e),c=G(e.cloud,50),u=o.cloudLow,m=G(r.cloudMid,c),d=G(e.precip,0),l=G(e.pop,0),p=G(e.vis,12),h=G(e.windScale,3),f=G(r.ws850,NaN),b=_a({t2m:r.t2m,z2m:r.stationElevation,t925:r.t925,z925:r.z925,t850:r.t850,z850:r.z850}),v=b.available,N=[],k=(g,M,I,E,F)=>{!Number.isFinite(E)||Math.abs(E)<.06||N.push({key:g,label:M,value:I,delta:E,detail:F,tone:E>0?"pro":"con"})},L=n.cloudseaProb;if(t==="cloudsea"){const g=i-o.top,M=D(g/200),I=D((o.top-i)/350);k("cloudbase","云层位置",o.hasLayer?`云顶约 ${Math.round(o.top)} m`:"无低云",o.hasLayer?2.4*M-2.2*I:-1.3,o.hasLayer?g>=0?`云底 ${Math.round(o.base)} m、云顶约 ${Math.round(o.top)} m，山顶在你脚下 ${Math.round(g)} m`:`云顶高出山顶约 ${Math.round(-g)} m，很可能身在雾中`:`低云 ${Math.round(u)}%，天空没有成片低云；露点 ${o.dewPoint.toFixed(1)} ℃ 算出的云底 ${Math.round(o.base)} m 只是理论值`),k("cloudlow","低云覆盖",`${Math.round(u)}%`,1.6*(D((u-30)/45)-.28),u<20?'低云太少且零散，天空通透，形不成"海"':u<45?"低云零散，能否连片完全看运气":u>70?"低云成片覆盖，具备成海的基本条件":"低云达到成片量级"),k("inversion",v?"逆温（实算）":"逆温（估算）",v?`${b.label}`:`${Math.round(Ue({dtr:Math.max(0,G(e.max,0)-G(e.min,0)),cloudNight:G(r.nightCloud,c),windScale:h})*100)}%`,v?2*(b.index-.35):.9*(Ue({dtr:Math.max(0,G(e.max,0)-G(e.min,0)),cloudNight:G(r.nightCloud,c),windScale:h})-.35),v?b.note:"缺少高空层结数据，用夜间温差与风力的代理指标估计"),Number.isFinite(G(r.rh850))&&k("moisture850","850 hPa 水汽",`${Math.round(r.rh850)}%`,1.1*D((r.rh850-62)/28),r.rh850>85?"约 1500 m 高度接近饱和，云层有充足水汽供给":r.rh850<55?"中低层偏干，云层难以维持":"水汽条件中等"),k("wind","风力",`${Math.round(h)} 级${Number.isFinite(f)?` · 850hPa ${f.toFixed(0)} m/s`:""}`,-.35*Math.max(0,h-3)-(Number.isFinite(f)?.3*D((f-8)/10):0),h>=4?"地面风偏大，逆温层容易被搅散":Number.isFinite(f)&&f>12?"高空风速大，层状云会被撕开":"风力温和，有利于层结稳定"),k("precip","降水",`${d} mm`,-1.5*D(d/8)-.6*D((l-55)/45),d>0?"当天有降水，云层结构不稳定":"无明显降水"),k("elevation","海拔",`${i} m`,.5*D((i-400)/800),i>=850?"海拔够高，更容易穿出云层":"海拔偏低，云顶经常与山顶齐平"),k("vis","能见度",`${p} km`,.25*D((p-8)/15)-.3*D((6-p)/6),p<5?"能见度低，可能是就地起雾而非云海":"能见度正常")}if(t==="sunrise"){const g=D((o.top-i)/300),M=D((u-55)/45),I=1-D(Math.abs(m-40)/42);k("cloudmid","中云量",`${Math.round(m)}%`,.85*I-1.1*D((m-70)/30)-.2,m>85?"中云过厚，太阳大概率被挡":m<12?"天空太干净，缺少出霞的层次":"中云量适中，霞光层次好"),k("cloudlow","低云遮挡",`${Math.round(u)}%`,-1.3*M,u>70?"低云压住东方地平线，日出可能被挡在云下":"低云不构成遮挡"),k("cloudtop","是否在云上",`${Math.round(o.top)} m`,-1.1*g,g>.5?"云顶高过山顶，可能在雾里等天亮":"山顶在云层之上，视野通透"),k("precip","降水",`${d} mm / ${Math.round(l)}%`,-1.5*D(d/6)-.7*D((l-40)/60),d>0?"有降水，日出段可能被雨云遮挡":"无降水干扰"),k("vis","能见度",`${p} km`,.6*D((p-8)/15)-.4*D((7-p)/7),p<6?"能见度差，远景发灰":"能见度可支撑远景"),k("wind","风力",`${Math.round(h)} 级`,-.4*D((h-4)/4),h>=6?"山顶风大，注意保暖与站稳":"风力可接受"),v&&k("inversion","逆温（实算）",b.label,.5*(b.index-.4),b.note),Number.isFinite(L)&&L>=55&&k("seabonus","云海叠加",`${L}%`,.7,"云海概率较高，日出会打在云面上")}if(t==="stars"){const g=D((G(r.cloudHigh,c)-25)/50);k("cloud","总云量",`${c}%`,-1.7*D((c-10)/55)-.5*g,c>60?"云量偏多，银河基本看不到":"天空较为通透"),k("cloudlow","低云雾",`${Math.round(u)}%`,-.9*D((u-20)/40),u>60?"低云或雾压顶，星点被完全遮挡":"低层无遮挡"),k("precip","降水",`${d} mm`,-1.6*D(d/5)-.5*D((l-30)/70),d>0?"有降水，不适合观星":"无降水"),k("humidity","水汽",`${Math.round(G(r.rh850,o.rh850))}%`,-.9*D((G(r.rh850,o.rh850)-65)/30),G(r.rh850,o.rh850)>85?"中低层水汽重，星光被散射变暗":"空气干爽，星点清晰");const M=D(n.moonIllum??0);k("moon","月光干扰",`${Math.round(M*100)}%`,-.6*M,M>.6?"接近满月，暗弱天体被压制":"月光干扰小"),k("vis","能见度",`${p} km`,.5*D((p-12)/16),p<10?"能见度一般，地平附近星点稀少":"通透度好"),k("wind","风力",`${Math.round(h)} 级`,-.3*D((h-3)/4),h>=5?"风大，长曝光会抖":"风力平稳")}const y=N.reduce((g,M)=>g+M.delta,0),$=(e.dateObj instanceof Date?e.dateObj:new Date).getMonth(),T=a.prior[$]??.15,w=Number(n.calibration?.offset)||0;let C=$a(Se(T)+y+w);C=Ft(C,.02,.96);const _=Math.round(C*100),S=[...N].sort((g,M)=>Math.abs(M.delta)-Math.abs(g.delta));return{probability:_,baseRate:Math.round(T*100),grade:za(_),factors:S,pros:S.filter(g=>g.tone==="pro").slice(0,3),cons:S.filter(g=>g.tone==="con").slice(0,3),confidence:Wa({...n,hasSounding:v}),calibration:n.calibration||{offset:0,n:0},geometry:o,inversion:b,sounding:r,verdict:ja(_),mode:t}}function za(e){return e>=72?{label:"值得去",tone:"great"}:e>=55?{label:"可以赌",tone:"good"}:e>=38?{label:"看运气",tone:"fair"}:e>=22?{label:"别抱期待",tone:"poor"}:{label:"建议改期",tone:"bad"}}function ja(e){return e>=72?"大概率能看到":e>=55?"有一半以上把握":e>=38?"要看运气":e>=22?"机会不大":"不值得专程跑一趟"}function Wa(e={}){const t=Number(e.dayIndex)||0;let n=.82-t*.07;e.hasSounding===!1&&(n-=.14);const a=Number(e.calibration?.n)||0;n+=Math.min(.1,a*.012),n=Ft(n,.15,.95);const s=n>=.72?"高":n>=.5?"中":"低",i=e.hasSounding===!1?"缺少高空层结数据，逆温为估算值":t>=4?"预报时效较远，临出发前一天请再看一次":a<3?"本地样本不足，尚未校准":"已结合你的历史反馈校正";return{score:Math.round(n*100),label:s,hint:i}}function Xt(e=[],t="cloudsea",n={}){if(!e.length)return{all:[],ranked:[],best:null};const a=e.map((r,o)=>Ke(r,"cloudsea",{...n,dayIndex:o,cloudseaProb:void 0}).probability),s=e.map((r,o)=>Object.assign(Ke(r,t,{...n,dayIndex:o,cloudseaProb:a[o]}),{day:r,index:o})),i=[...s].sort((r,o)=>o.probability-r.probability);return{all:s,ranked:i,best:i[0]||null}}const ve=e=>e?`${String(e.getHours()).padStart(2,"0")}:${String(e.getMinutes()).padStart(2,"0")}`:"--:--",Qt=e=>{const t=e.dateObj instanceof Date?e.dateObj:new Date(e.date);return`${t.getMonth()+1} 月 ${t.getDate()} 日`};function Ye(e,t){if(e===0)return"今天";if(e===1)return"明天";if(e===2)return"后天";const n=t?.dateObj instanceof Date?t.dateObj:new Date(t?.date||Date.now());return["周日","周一","周二","周三","周四","周五","周六"][n.getDay()]||Qt(t||{})}function Jt(e,t){const n=(Number(e.max)+Number(e.min))/2;return Number.isFinite(n)?Math.round(n-(t-30)/100*.6):null}function $n(e,t="cloudsea",n={}){if(!e)return"暂无预报数据。";const a=e.day,s=a.dateObj instanceof Date?a.dateObj:new Date(a.date),i=n.lat??22.58,r=n.lon??114.2,o=xt(s,i,r),c=ke(s,i),u=Gt(c),m=n.name||"山顶",d=Jt(a,n.elevation||600);if(t==="stars"){const h=Math.round((e.moonIllum??0)*100);return`${Qt(a)} 天黑后，${m}看到星空概率 ${e.probability}%（月光亮度 ${h}%）。山顶气温约 ${d} ℃，比市区低 4—6 ℃，记得带保暖层和头灯。`}const l=ve(o.sunrise),p=e.probability>=72?`值得为它早起。建议 ${ve(new Date(o.sunrise.getTime()-90*6e4))} 前从山脚出发`:e.probability>=55?`可以去，但留个 B 计划。${ve(new Date(o.sunrise.getTime()-90*6e4))} 前上山`:"如果本来就要上山，可以顺手看一眼；不建议专程跑";return`${Qt(a)} ${l} 前后，${m}${u}，看到${et[t].name}概率 ${e.probability}%。${p}。山顶约 ${d} ℃，带一件防风外套。`}function Mn({all:e=[],mode:t="cloudsea",todayProb:n}){if(!e.length)return null;const a=Number.isFinite(n)?n:e[0].probability,s=e.find((r,o)=>o>0&&r.probability>=Math.max(55,a+15));return s?{tone:"hopeful",text:`这次没等到不怪你。${s.index} 天后（${Qt(s.day)}）有 ${s.probability}% 的窗口，比今天高 ${s.probability-a} 个百分点。到那天我会提前提醒你。`,target:s}:{tone:"consoling",text:`未来一周${et[t].name}的机会都不好，最高只有 ${Math.max(...e.map(r=>r.probability))}%。这次别硬上，把体力留给下一次。`,target:null}}const kn="feedback",Ba=8,Ve=.9;let vt=null;async function Sn(){return vt||(vt=await Le(kn)),vt}async function Ua({mountainId:e,mode:t,date:n,predicted:a,observed:s,source:i="live"}){const r={id:`${e}_${t}_${n}`,mountainId:e,mode:t,date:n,predicted:Math.round(Number(a)||0),observed:s?1:0,source:i,ts:Date.now()};if(await ne(kn,r),vt){const o=vt.findIndex(c=>c.id===r.id);o>=0?vt[o]=r:vt.push(r)}return r}async function te(e,t){const a=(await Sn()).filter(u=>u.mountainId===e&&u.mode===t);if(!a.length)return{offset:0,n:0,hitRate:null,meanPredicted:null};const s=a.reduce((u,m)=>u+(m.observed?1:0),0),i=a.reduce((u,m)=>u+m.predicted,0)/a.length/100,r=s/a.length,o=a.length/(a.length+Ba),c=Se(r)-Se(i);return{offset:Ft(c*o,-Ve,Ve),n:a.length,hitRate:r,meanPredicted:i,note:a.length<3?`已收集 ${a.length} 次反馈，满 3 次开始参与校准`:`基于你的 ${a.length} 次反馈：实测命中 ${Math.round(r*100)}%，模型平均预测 ${Math.round(i*100)}%`}}async function ge(){const e=await Sn();return{total:e.length,rows:e}}function Za(){vt=null}const be={一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};function Ga(e){if(!e)return null;if(e==="半")return .5;if(e.includes("十")){const[t,n]=e.split("十");return(be[t]||1)*10+(n&&be[n]||0)}return be[e]??null}function Ka(e){let t=e.match(/(\d+(?:\.\d+)?)\s*个?\s*小时/);return t?Number(t[1]):(t=e.match(/([一两二三四五六七八九十半])\s*个?\s*小时/),t?Ga(t[1]):/半小时/.test(e)?.5:/半天/.test(e)?3.5:/一整天|全天|一天/.test(e)?8:null)}function Ya(e){const t=e.match(/爬升\s*(?:不超过|少于|控制在)?\s*(\d{2,4})\s*(?:米|m)/);return t?Number(t[1]):null}const Va=[{key:"日出",re:/日出|看太阳|晨光/},{key:"日落",re:/日落|夕阳/},{key:"云海",re:/云海/},{key:"星空",re:/星空|银河|看星|星轨/},{key:"海景",re:/海景|看海|海边/},{key:"溪谷",re:/溪谷|溪流|瀑布|玩水/},{key:"城市",re:/城市|夜景|灯光/},{key:"夜爬",re:/夜爬|晚上爬|下班后/},{key:"越野跑",re:/越野跑|跑步|训练/},{key:"重装",re:/重装|露营|过夜/}],Xa={日出:["日出"],日落:["日落"],云海:["云海"],星空:["观星","星空"],海景:["海景"],溪谷:["溪谷","瀑布"],城市:["城市"],夜爬:["夜爬"],越野跑:["越野跑"],重装:["重装"]},Nn=(e,t)=>(Xa[t]||[t]).some(n=>e.tags.includes(n));function Qa(e=""){const t=String(e).trim(),n={maxHours:Ka(t),maxAscent:Ya(t),difficultyMin:null,difficultyMax:null,tags:new Set,audience:null,kidAge:null},a=[],s=[];for(const c of Va)c.re.test(t)&&n.tags.add(c.key);n.tags.size&&a.push(`想要${[...n.tags].join(" / ")}`),n.maxHours&&a.push(`${n.maxHours} 小时以内`),n.maxAscent&&a.push(`爬升不超过 ${n.maxAscent} 米`);const i=t.match(/(\d{1,2})\s*岁/),r=/孩子|小孩|娃|儿子|女儿|亲子|带娃/.test(t),o=/爸妈|父母|老人|长辈|爷爷|奶奶/.test(t);return r||i?(n.audience="kid",n.kidAge=i?Number(i[1]):null,n.difficultyMax=n.kidAge&&n.kidAge<=8?2:3,n.maxHours==null&&(n.maxHours=4),a.push(n.kidAge?`带 ${n.kidAge} 岁小孩`:"带孩子")):o?(n.audience="elder",n.difficultyMax=2,n.maxHours==null&&(n.maxHours=4),a.push("有长辈同行")):/新手|第一次|没爬过|小白/.test(t)?(n.audience="beginner",n.difficultyMax=2,a.push("新手友好")):/有经验|经常爬|老手|挑战|虐|强度大/.test(t)&&(n.audience="expert",n.difficultyMin=3,a.push("想要有强度")),/停车场|停车/.test(t)&&s.push("停车场信息暂未收录"),/门票|收费/.test(t)&&s.push("门票价格暂未收录"),/水源|补水/.test(t)&&s.push("沿途水源点暂未收录"),{constraints:n,understood:a,unsupported:s,query:t}}function Ja({understood:e,unsupported:t}){if(!e.length)return"我还没听懂你的条件，可以试试「周六带 6 岁孩子，2 小时能来回」。";const n=`我理解你要的是：${e.join("，")}。`;return t.length?`${n}（${t.join("、")}，不参与筛选）`:n}function ts(e){const t=e.constraints,n=$t.map(o=>{const c=[...t.tags].filter(h=>Nn(o,h)).length,u=t.maxHours?o.route.hours-t.maxHours:0,m=t.maxAscent?o.route.ascent-t.maxAscent:0;let d=0;t.difficultyMax!=null&&(d=Math.max(0,o.difficulty-t.difficultyMax)),t.difficultyMin!=null&&(d=Math.max(d,Math.max(0,t.difficultyMin-o.difficulty)));const l=t.tags.has("云海")||t.tags.has("星空")?(o.elevation-400)/600:0,p=c*3-Math.max(0,u)*1.6-Math.max(0,m)/180-d*2+l;return{mountain:o,score:p,tagHits:c,overHours:u,overAscent:m,difDelta:d}}),a=n.filter(o=>o.overHours<=.25&&o.overAscent<=60&&o.difDelta===0),s=a.length?a:n.filter(o=>o.overHours<=1.5&&o.difDelta<=1),i=!a.length,r=[...s.length?s:n].sort((o,c)=>c.score-o.score).slice(0,3).map(o=>({mountain:o.mountain,why:es(o,t)}));return{items:r,relaxed:i,note:i?"没有完全符合的路线，下面是放宽条件后最接近的三条——哪一条超了会写在理由里。":a.length>r.length?`有 ${a.length} 条符合，先看最合适的三条。`:`找到 ${a.length} 条符合的路线。`}}function es(e,t){const n=[];t.maxHours&&n.push(e.overHours<=0?`约 ${e.mountain.route.hours} 小时，在 ${t.maxHours} 小时内`:`约 ${e.mountain.route.hours} 小时，比你说的多 ${e.overHours.toFixed(1)} 小时`),t.maxAscent&&n.push(e.overAscent<=0?`爬升 ${e.mountain.route.ascent} 米`:`爬升 ${e.mountain.route.ascent} 米，略超 ${Math.round(e.overAscent)} 米`),t.difficultyMax!=null&&e.mountain.difficulty<=t.difficultyMax&&n.push(`难度 ${e.mountain.difficulty}/5，适合当前水平`);const a=[...t.tags].filter(s=>Nn(e.mountain,s));return a.length&&n.push(`有${a.join("、")}`),n.length||n.push(e.mountain.desc),n.slice(0,3).join(" · ")}const ns=["周六带 6 岁孩子，2 小时能来回","明早想看云海，能爬 3 小时的","一个人夜爬，安全的","想拍海景，半天强度"],as=[[5,"凌晨"],[8,"清晨"],[11,"上午"],[14,"正午"],[17,"下午"],[19,"傍晚"],[24,"夜里"]];function ss(e){const t=new Date(e).getHours();for(const[n,a]of as)if(t<n)return a;return"夜里"}function is(e,t){const n=Number(String(t).match(/\d+/)?.[0]??0);return e?n>=6?"风大得站不稳":/东|南/.test(e)?"风从海上来":/北/.test(e)?"北风带着凉意":n<=2?"几乎没有风":`${e}吹着`:""}function os({trail:e={},weather:t=null,mountain:n={},mode:a="hike"}){const s=new Date(e.startedAt||Date.now()),i=new Date(e.endedAt||Date.now()),r=e.stats||{},o=t?.now||{},c=n.name||e.mountainName||"山里",u=n.elevation||r.maxEle||null,m=ss(s),d=`${s.getMonth()+1} 月 ${s.getDate()} 日`,l=a==="cloudsea"?"等到了一场云海":a==="sunrise"?"守到了日出":a==="stars"?"看到了一整个银河":a==="dawn"?"赶在天亮前上了山":"走完了一段山路",p=[];p.push(`${d}${m}`),p.push(Z(s,!1).slice(0,5)),p.push(`你在${c}${l}`),u&&p.push(`海拔 ${u} 米`),o.temp!==void 0&&p.push(`气温 ${o.temp}℃`);const h=is(o.windDir,o.windScale);h&&p.push(h);const f=p.join("，").replace(/，(\d{2}:\d{2})$/," $1")+"。",b=[];r.distanceKm&&b.push(`${Number(r.distanceKm).toFixed(1)} 公里`),r.elevation?.gain&&b.push(`累计爬升 ${r.elevation.gain} 米`);const v=(i-s)/36e5;return v>.1&&v<30&&b.push(`用时 ${v.toFixed(1)} 小时`),{headline:f,detail:b.join(" · "),tags:rs({mode:a,weather:t,elevation:u}),meta:{date:d,time:Z(s,!1).slice(0,5),place:c,elevation:u,coord:e.points?.[0]?`${e.points[0].lat.toFixed(4)}, ${e.points[0].lon.toFixed(4)}`:"",temp:o.temp,weather:o.text||""}}}function rs({mode:e,weather:t,elevation:n}){const a=[];e!=="hike"&&a.push({sunrise:"日出",cloudsea:"云海",stars:"星空"}[e]),Number(n)>=900&&a.push("千米峰");const s=Number(t?.now?.vis);return Number.isFinite(s)&&s>=15&&a.push("通透"),t?.now?.text&&a.push(t.now.text),a.filter(Boolean).slice(0,3)}function cs(e,t){if(!t||!e)return null;const n=e.stats||{},a=t.stats||{},s=(n.elevation?.gain||0)-(a.elevation?.gain||0),i=(n.distanceKm||0)-(a.distanceKm||0);return Math.abs(s)>=30?s>0?`比上次多爬了 ${Math.round(s)} 米，进步了。`:`比上次少爬 ${Math.abs(Math.round(s))} 米，这次是收着走的。`:Math.abs(i)>=.5?i>0?`比上次多走了 ${i.toFixed(1)} 公里。`:`比上次短 ${Math.abs(i).toFixed(1)} 公里，轻松一些。`:"和上次强度相当，稳定输出。"}function ls(e=[]){if(!e.length)return null;const t=new Date().getFullYear(),n=e.filter(o=>new Date(o.startedAt).getFullYear()===t);if(!n.length)return null;const a=n.reduce((o,c)=>o+(c.stats?.distanceKm||0),0),s=n.reduce((o,c)=>o+(c.stats?.elevation?.gain||0),0),i=n.filter(o=>new Date(o.startedAt).getHours()<8).length,r=new Set(n.map(o=>new Date(o.startedAt).getMonth()));return{year:t,count:n.length,km:Number(a.toFixed(1)),gain:Math.round(s),dawn:i,months:r.size,text:`${t} 年你上山 ${n.length} 次，累计 ${a.toFixed(1)} 公里、爬升 ${Math.round(s)} 米，其中 ${i} 次是为了赶天亮出门。`}}const ds=["cloudsea","sunrise","stars"],us=[{id:"chase",name:"追光",desc:"概率 · 坡向 · 时间",icon:"sunrise",tone:"dawn"},{id:"trail",name:"轨迹",desc:"记录 · 卡片",icon:"footprint",tone:""},{id:"weather",name:"天气",desc:"实时 · 预警",icon:"cloudSun",tone:""}];function hs(e){const t=Date.now();return e.find(n=>{const a=n.day.dateObj instanceof Date?n.day.dateObj:new Date(n.day.date),s=xt(a,22.58,114.2);return s.sunrise?n.index>0||t<s.sunrise.getTime()+30*6e4:n.index>0})||e[0]}const ps={id:"home",title:"首页",icon:"home",template(){const e=q();return`
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
          ${ns.map(t=>`<button class="chip chip--sm" type="button" data-chip="${A(t)}">${A(t)}</button>`).join("")}
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
          ${us.map(t=>`<button class="feature ${t.tone?`feature--${t.tone}`:""}" type="button" data-go="${t.id}">
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
    `},async mount(e){const t=h=>e.querySelector(h),n=q();e.addEventListener("click",h=>{const f=h.target.closest("[data-go]");if(f){Dt(f.dataset.go);return}h.target.closest('[data-action="mountain"]')&&m(),h.target.closest('[data-action="retry-weather"]')&&(t("#verdictSentence").textContent="正在重新获取…",ft(!0).then(b=>{i(b),s(b)}).catch(b=>{t("#verdictSentence").innerHTML=`${A(b.message||"仍然连不上")}。<br /><button class="btn btn--sm btn--ghost" type="button" data-action="retry-weather" style="margin-top:10px">再试一次</button>`,ot(b.message||"天气获取失败")}))}),t("#heroDate").textContent=Tt(new Date,!0);let a={offset:0,n:0};const s=h=>{if(!h?.daily?.length)return;const f=q(),b=Xt(h.daily,"cloudsea",{mountain:f,source:h.source,calibration:a}),v=hs(b.all);if(!v)return;const N=v.probability,k=v.index===0?"今天清晨":v.index===1?"明天清晨":`${v.index} 天后`,L=v.day.dateObj instanceof Date?v.day.dateObj:new Date(v.day.date),y=xt(L,f.lat,f.lon);t("#verdictKicker").innerHTML=`${x("sparkles",13)} ${k} · ${Z(y.sunrise,!1).slice(0,5)} 前后`,t("#verdictNum").textContent="0",t("#verdictNum").dataset.target=String(N),Wn(t("#verdictNum"),N,{duration:700}),t("#verdictMode").textContent="云海概率",t("#verdictGrade").textContent=v.grade.label,t("#verdictGrade").className=`verdict__grade is-${v.grade.tone}`,t("#verdictSentence").textContent=$n(v,"cloudsea",f);const $=[];if(v.factors.slice(0,2).forEach(_=>$.push({tone:_.tone,text:_.detail||`${_.label} ${_.value}`})),v.probability>=22){const _=Jt(v.day,f.elevation);_!=null&&$.push({tone:"neutral",text:`山顶约 ${_} ℃`})}t("#verdictFacts").innerHTML=$.filter(_=>_.text).slice(0,3).map(_=>`<span class="verdict__fact is-${_.tone}">
            <i>${_.tone==="pro"?"＋":_.tone==="con"?"－":"·"}</i>${A(_.text)}
          </span>`).join(""),t("#verdictFoot").textContent=`基准率 ${v.baseRate}% · 置信度 ${v.confidence.label} · ${h.providerName||"实时预报"} ${Z(h.updatedAt)} 更新`;const T=ds.map(_=>{const S=_==="cloudsea"?v:Xt(h.daily,_,{mountain:f,source:h.source,calibration:a}).all[v.index];return{key:_,name:et[_].name,prob:S?.probability??0,icon:et[_].icon}});t("#miniModes").innerHTML=T.map(_=>`<button class="mini-mode ${_.key==="cloudsea"?"is-active":""}" type="button" data-mode="${_.key}">
            <span class="mini-mode__icon">${x(_.icon,15)}</span>
            <span class="mini-mode__name">${_.name}</span>
            <span class="mini-mode__prob">${_.prob}%</span>
          </button>`).join("");const w=Mn({all:b.all,mode:"cloudsea",todayProb:v.probability}),C=v.probability<55&&w;t("#compensateSection").hidden=!C,C&&(t("#compensateCard").innerHTML=`
          <span class="compensate__icon">${x(w.tone==="hopeful"?"sunrise":"moon",18)}</span>
          <p>${A(w.text)}</p>`,t("#compensateCard").classList.toggle("is-hopeful",w.tone==="hopeful")),e.querySelectorAll("[data-mode]").forEach(_=>{_.addEventListener("click",()=>Dt(`chase?mode=${_.dataset.mode}`))})},i=h=>{if(!h)return;t("#heroTemp").textContent=h.now.temp,t("#heroCond").textContent=`体感 ${h.now.feels}°`;const f=t("#heroSource");f.textContent=`${h.providerName||"实时数据"} · ${Z(h.updatedAt)}`,f.style.opacity="1"},r=t("#askForm"),o=t("#askInput"),c=t("#askResult"),u=h=>{const f=Qa(h);o.value=h;const b=Ja(f),v=ts(f),N=v.items.map(k=>`<button class="route-card" type="button" data-pick="${k.mountain.id}">
            <span class="route-card__main">
              <span class="route-card__name">${k.mountain.name}
                <small>${k.mountain.elevation} m · 难度 ${k.mountain.difficulty}/5</small>
              </span>
              <span class="route-card__why">${A(k.why)}</span>
            </span>
            <span class="route-card__go">${x("chevronRight",15)}</span>
          </button>`).join("");c.innerHTML=`
        <p class="ask__echo">${A(b)}</p>
        ${f.understood.length?`<p class="ask__note">${A(v.note)}</p>`:""}
        <div class="route-list">${N||'<div class="empty"><div class="empty__title">没有匹配的路线</div></div>'}</div>`};r.addEventListener("submit",h=>{h.preventDefault();const f=o.value.trim();f&&u(f)}),t("#askChips").addEventListener("click",h=>{const f=h.target.closest("[data-chip]");f&&u(f.dataset.chip)}),c.addEventListener("click",h=>{const f=h.target.closest("[data-pick]");f&&(Ne(f.dataset.pick),Dt("chase"))});function m(){const h=`<div class="list">
        ${$t.map(v=>`<button class="list-row" type="button" data-mountain="${v.id}">
            <span class="list-row__icon">${x("mountain",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${v.name} <span class="muted" style="font-weight:400">${v.elevation}m</span></span>
              <span class="list-row__sub">${v.area} · ${v.tags.slice(0,3).join(" / ")}</span>
            </span>
            <span class="list-row__tail">${v.id===H.mountainId?"当前":""}</span>
          </button>`).join("")}
      </div>`,{el:f,close:b}=Ee({title:"换个山头",body:h});f.addEventListener("click",v=>{const N=v.target.closest("[data-mountain]");N&&(Ne(N.dataset.mountain),b(),t("#verdictMountain").innerHTML=`${q().name} ${x("chevronDown",13)}`,te(N.dataset.mountain,"cloudsea").then(k=>(a=k,ft())).then(k=>s(k)))})}const d=async()=>{const h=t("#recentTrails"),f=await Ht.list();if(!f.length){h.innerHTML=`
          <div class="empty">
            ${x("footprint",34)}
            <div class="empty__title">还没有记录过轨迹</div>
            <div class="empty__desc">上山前点一下「开始记录」，下山后能生成一张带天气的卡片</div>
          </div>`,t("#recapSection").hidden=!0;return}h.innerHTML=`<div style="padding:6px 14px 10px">
        ${f.slice(0,3).map((N,k)=>`<button class="list-row" type="button" data-trail="${N.id}">
              <span class="list-row__icon">${x("route",18)}</span>
              <span class="list-row__main">
                <span class="list-row__title">${A(N.name)}</span>
                <span class="list-row__sub">${Tt(N.startedAt)} · ${Te((N.stats?.distanceKm||0)*1e3)} · 爬升 ${N.stats?.elevation?.gain||0} m</span>
              </span>
              <span class="list-row__tail">${k===0?Da(N.startedAt):""}</span>
            </button>`).join("")}
      </div>`;const b=ls(f);b&&(t("#recapSection").hidden=!1,t("#recapCard").innerHTML=`
          <span class="recap__year">${b.year}</span>
          <p>${b.text}</p>`);const v=cs(f[0],f[1]);if(v&&f[0]?.id){const N=h.querySelector(`[data-trail="${f[0].id}"] .list-row__sub`);N&&(N.textContent=`${Te((f[0].stats?.distanceKm||0)*1e3)} · ${v}`)}};e.addEventListener("click",h=>{h.target.closest("[data-trail]")&&Dt("trail")});const l=B.on("weather:change",h=>{i(h),s(h)}),p=B.on("trail:change",d);try{a=await te(n.id,"cloudsea");const h=await ft();i(h),s(h)}catch(h){t("#verdictNum").textContent="--",t("#verdictGrade").textContent="取数失败",t("#verdictKicker").innerHTML=`${x("info",13)} 没有数据`,t("#verdictSentence").innerHTML=`${A(h.message||"天气服务连不上")}。<br /><button class="btn btn--sm btn--ghost" type="button" data-action="retry-weather" style="margin-top:10px">重试</button>`,t("#verdictFacts").innerHTML="",ot(h.message||"天气获取失败")}return d(),t("#homeVersion").textContent="v2.3.0",()=>{l(),p()}},onShow(){ft().catch(()=>{})}},ms=63710088e-1;function fs(e,t){const n=c=>c*Math.PI/180,a=n(t.lat-e.lat),s=n(t.lon-e.lon),i=n(e.lat),r=n(t.lat),o=Math.sin(a/2)**2+Math.cos(i)*Math.cos(r)*Math.sin(s/2)**2;return 2*ms*Math.asin(Math.min(1,Math.sqrt(o)))}function vs(e,t){let n=_t[0],a=1/0;for(const s of _t){const i=fs({lat:e,lon:t},s);i<a&&(a=i,n=s)}return{...n,distance:a}}function gs(e={}){const{timeout:t=12e3,maximumAge:n=3e4,enableHighAccuracy:a=!0}=e;return new Promise((s,i)=>{if(!("geolocation"in navigator)){i(new Error("当前环境不支持定位"));return}navigator.geolocation.getCurrentPosition(r=>s({lat:r.coords.latitude,lon:r.coords.longitude,accuracy:r.coords.accuracy,altitude:r.coords.altitude,heading:r.coords.heading,speed:r.coords.speed,ts:r.timestamp}),r=>{const o={1:"定位权限被拒绝，请在系统设置中允许",2:"暂时无法获取位置，请到空旷处重试",3:"定位超时，请重试"};i(new Error(o[r.code]||r.message))},{timeout:t,maximumAge:n,enableHighAccuracy:a})})}function Xe(e,t,n={}){if(!("geolocation"in navigator))return t?.(new Error("当前环境不支持定位")),()=>{};const a=navigator.geolocation.watchPosition(s=>e({lat:s.coords.latitude,lon:s.coords.longitude,accuracy:s.coords.accuracy,altitude:s.coords.altitude,heading:s.coords.heading,speed:s.coords.speed,ts:s.timestamp}),s=>t?.(new Error(s.message||"定位失败")),{enableHighAccuracy:!0,maximumAge:1e3,timeout:2e4,...n});return()=>navigator.geolocation.clearWatch(a)}function Qe(e=""){return{Minor:1,Moderate:2,Severe:3,Extreme:4}[e]||1}function bs(e=""){return{Minor:"minor",Moderate:"moderate",Severe:"severe",Extreme:"extreme"}[e]||"minor"}const ys={id:"weather",title:"天气",icon:"cloudSun",template(){return`
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
            ${x("map",15)}<span id="wxCityName">${H.location.name}</span>${x("chevronDown",13)}
          </button>
          <div class="wx-hero__tags">
            <span class="wx-observed" id="wxObserved">--</span>
            <span class="badge badge--glass" id="wxSource">--</span>
          </div>
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
          <span class="badge" id="wxRainBadge">${x("droplet",12)} 降水概率</span>
        </div>
        <div class="card" style="padding:10px 12px">
          <div class="hourly-scroll" id="wxHourly">
            ${Array.from({length:6}).map(()=>'<div class="skeleton" style="width:62px;height:170px;flex:none"></div>').join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <div><h2 class="section__title">7 日预报</h2></div>
          <span class="badge" id="wxDailyHint">${x("cloud",12)} 日间现象</span>
        </div>
        <div class="card" id="wxDaily" style="padding:6px 16px">
          <div class="loading-inline"><span class="spinner"></span>加载中…</div>
        </div>
      </section>

      <section class="section" id="wxAirSection">
        <div class="section__head">
          <div><h2 class="section__title">空气质量</h2></div>
          <span class="badge" id="wxAirScale">中国标准</span>
        </div>
        <div class="card" id="wxAir">
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
          <div class="kv"><span class="kv__k">实况时次</span><span class="kv__v" id="wxObserved2">--</span></div>
          <div class="kv"><span class="kv__k">气压口径</span><span class="kv__v" id="wxPressureNote">--</span></div>
          <div class="kv"><span class="kv__k">日出 / 日落</span><span class="kv__v" id="wxSun">--</span></div>
          <div class="kv"><span class="kv__k">月相</span><span class="kv__v" id="wxMoon">--</span></div>
          <p class="field__hint" style="margin-top:10px">
            实况取自 Open-Meteo 的 15 分钟插值场（ECMWF / GFS），不是整点预报值。
            <strong>气压为海平面气压</strong>，比手机气压计显示的本站气压高，两者差值对应海拔高度差，不是数据错了。
            AQI 按 HJ 633-2012 由 PM2.5、PM10、O₃、NO₂、SO₂、CO 六项浓度算得，与国内天气 App 同口径。
          </p>
        </div>
      </section>
    `},async mount(e){const t=o=>e.querySelector(o),n=o=>{if(!o)return;const{now:c,hourly:u,daily:m,air:d,indices:l,sun:p,moon:h}=o;t("#wxCityName").textContent=o.place.name,t("#wxSource").textContent=o.providerName||"实时数据",t("#wxTemp").textContent=c.temp,t("#wxCond").textContent=`${c.text}`;const f=c.observedAt instanceof Date?c.observedAt:new Date(o.updatedAt);t("#wxObserved").textContent=`实况 ${Z(f)}`;const b=o.warnings||[],v=t("#wxWarnings");if(!b.length)v.innerHTML="";else{const _=[...b].sort((S,g)=>Qe(g.severity)-Qe(S.severity));v.innerHTML=_.slice(0,3).map(S=>`<div class="warn-banner is-${bs(S.severity)}">
              <span class="warn-banner__icon">${x("alert",17)}</span>
              <span class="warn-banner__main">
                <span class="warn-banner__title">${A(S.title||S.typeName||"气象预警")}</span>
                <span class="warn-banner__time">${A(S.typeName||"")}${S.pubTime?` · ${Z(new Date(S.pubTime))} 发布`:""}</span>
              </span>
            </div>`).join("")}t("#wxFeel").textContent=`体感 ${c.feels}° · 今日 ${m[0]?.min??"--"}~${m[0]?.max??"--"}°`,t("#wxIcon").innerHTML=Ut(c.code,84);const N=Number(c.pressureDelta),k=Number.isFinite(N)?N>.8?{icon:x("arrowUp",10),text:"3h 上升"}:N<-.8?{icon:x("arrowDown",10),text:"3h 下降"}:{icon:x("minus",10),text:"3h 平稳"}:{icon:"",text:"海平面"},L=Number(c.vis),y=L>=20?"通透":L>=10?"良好":L>=5?"一般":"较差";t("#wxMetrics").innerHTML=[{k:"湿度",v:`${c.humidity}<i>%</i>`,sub:`露点 ${c.dew}°`},{k:"风",v:`${c.windDir}<b>${c.windScale}</b><i>级</i>`,sub:`阵风 ${c.gust} m/s`},{k:"气压",v:`${c.pressure}<i>hPa</i>`,sub:`${k.icon}${k.text}`,raw:!0},{k:"能见度",v:`${c.vis}<i>km</i>`,sub:`${y} · 云量 ${c.cloud}%`}].map(_=>`<div class="wx-metric">
            <div class="wx-metric__k">${_.k}</div>
            <div class="wx-metric__v">${_.v}</div>
            <div class="wx-metric__sub">${_.sub}</div>
          </div>`).join(""),t("#wxUpdated").textContent=`${Z(o.updatedAt)} 更新 · ${o.providerName||"实时预报"}`;const $=t("#wxHourly");if(u?.length){const _=u.length,S=62,g=6,M=56,I=_*S+(_-1)*g,E=u.map(O=>Number(O.temp)).filter(Number.isFinite),F=E.length?Math.max(...E):30,at=E.length?Math.min(...E):20,z=Math.max(1,F-at),ht=O=>(O*(S+g)+S/2)/I*100,R=O=>M-9-(Number(O)-at)/z*(M-18),K=u.map((O,Y)=>[ht(Y),R(O.temp)]);let Rt=`M ${K[0][0].toFixed(2)} ${K[0][1].toFixed(2)}`;for(let O=0;O<_-1;O++){const Y=((K[O][0]+K[O+1][0])/2).toFixed(2);Rt+=` C ${Y} ${K[O][1].toFixed(2)}, ${Y} ${K[O+1][1].toFixed(2)}, ${K[O+1][0].toFixed(2)} ${K[O+1][1].toFixed(2)}`}$.innerHTML=`
          <div class="hourly-track" style="width:${I}px">
            <div class="hourly-curve">
              <svg viewBox="0 0 100 ${M}" preserveAspectRatio="none" aria-hidden="true">
                <path class="hourly-curve__line" d="${Rt}" vector-effect="non-scaling-stroke" />
              </svg>
              ${u.map((O,Y)=>`<span class="hourly-dot" style="left:${K[Y][0].toFixed(2)}%;top:${(K[Y][1]/M*100).toFixed(2)}%"></span>`).join("")}
              ${u.map((O,Y)=>`<span class="hourly-pt ${K[Y][1]>M/2?"is-low":""}" style="left:${K[Y][0].toFixed(2)}%;top:${(K[Y][1]/M*100).toFixed(2)}%">${O.temp}°</span>`).join("")}
            </div>
            <div class="hourly-cols">
              ${u.map((O,Y)=>{const Pt=Y===0;return`<div class="hour ${Pt?"is-now":""}">
                    <span class="hour__t">${Pt?"现在":Z(O.time)}</span>
                    <span class="hour__icon">${Ut(O.code,24)}</span>
                    <span class="hour__gap"></span>
                    <span class="hour__pop">${O.pop>10?`${O.pop}%`:"<i>—</i>"}</span>
                    <span class="hour__wind">${x("wind",10)}${O.windScale}级</span>
                  </div>`}).join("")}
            </div>
          </div>`}else $.innerHTML='<div class="empty__desc">暂无逐小时数据</div>';const T=t("#wxDaily");if(m?.length){const _=m.map(E=>E.min),S=m.map(E=>E.max),g=Math.min(..._),M=Math.max(...S),I=Math.max(1,M-g);T.innerHTML=m.map((E,F)=>{const at=F===0?"今天":F===1?"明天":xn[E.dateObj.getDay()],z=(E.min-g)/I*100,ht=Math.max(8,(E.max-E.min)/I*100);return`<div class="day-row">
              <span class="day-row__name">${at}</span>
              <span class="day-row__icon">${Ut(E.codeDay,22)}</span>
              <span class="day-row__bar"><span style="left:${z}%;width:${ht}%"></span></span>
              <span class="day-row__temp"><b>${E.max}°</b> / ${E.min}°</span>
            </div>`}).join("")}const w=t("#wxAir");if(d&&d.pollutants?.length){t("#wxAirScale").textContent=d.standard==="CN MEE"?"模式估算 · HJ 633":"欧洲 EAQI";const _=d.pollutants.reduce((S,g)=>g.iaqi>S.iaqi?g:S,d.pollutants[0]).key;w.innerHTML=`
          <div class="air-head">
            <div class="air-score is-${d.tone}">
              <span class="air-score__num">${d.aqi}</span>
              <span class="air-score__cat">${A(d.category)}</span>
            </div>
            <div class="air-head__meta">
              <span class="air-head__label">AQI · HJ 633-2012</span>
              <span class="air-head__primary">${d.primary?`首要污染物 ${A(d.primary)}`:"各项均优于一级限值"}</span>
            </div>
          </div>
          <div class="air-grid">
            ${d.pollutants.map(S=>`<div class="air-item ${S.key===_&&d.aqi>50?"is-primary":""}">
                  <span class="air-item__k">${S.name}</span>
                  <span class="air-item__v">${S.value}<i>${S.unit.replace("μg/m³","")}</i></span>
                  <span class="air-item__bar"><i style="width:${Math.min(100,Math.round(S.iaqi/2))}%"></i></span>
                </div>`).join("")}
          </div>
          <p class="air-note">
            浓度来自 CAMS 全球空气质量模式，国内监测站实测通常更低；AQI 按 HJ&nbsp;633-2012 由六项浓度取分指数最大值算得。
          </p>`}else t("#wxAirScale").textContent="暂不可用",w.innerHTML='<div class="empty__desc" style="padding:10px 0">空气质量数据未取到。这一项来自独立接口，失败不影响上方预报。</div>';const C=t("#wxIndices");if(l?.length){const _={1:"activity",2:"thermometer",3:"sun",5:"droplet",6:"tent",9:"heart"};C.innerHTML=l.slice(0,6).map(S=>`<div class="index-item">
              <span class="index-item__k">${x(_[S.type]||"info",13)}${S.name}</span>
              <span class="index-item__v">${A(S.category)}</span>
              <span class="index-item__d">${A(S.text)}</span>
            </div>`).join("")}else C.innerHTML="";t("#wxProvider").textContent=o.providerName==="和风天气"?"和风天气 QWeather":"Open-Meteo（ECMWF / GFS）",t("#wxObserved2").textContent=`${Z(f)}（15 分钟插值）`,t("#wxPressureNote").textContent=c.pressureStation?`海平面 ${c.pressure} · 本站 ${c.pressureStation} hPa（格点海拔 ${Math.round(o.elevation||0)} m）`:`${c.pressure} hPa（本站）`,t("#wxSun").textContent=p?.sunrise?`${Z(p.sunrise)} / ${Z(p.sunset)}`:"--",t("#wxMoon").textContent=h?`${h.phaseName} · 照亮 ${Math.round(h.illumination*100)}%`:"--"},a=async(o=!1)=>{try{const c=await ft(o);n(c)}catch(c){dt(c.message||"天气加载失败")}},s=()=>{const c=`
        <div class="input-group" style="margin-bottom:14px">
          <input class="input" id="citySearch" placeholder="搜索城市，如 深圳 / 惠州" />
          <button class="btn btn--primary btn--sm" type="button" id="citySearchBtn">搜索</button>
        </div>
        <div id="cityList">
          ${[...new Set(_t.map(p=>p.group))].map(p=>`<div style="margin-bottom:12px">
                <div class="settings-group__title">${p}</div>
                ${_t.filter(h=>h.group===p).map(h=>`<button class="list-row" type="button" data-city='${JSON.stringify({name:h.name,lat:h.lat,lon:h.lon})}'>
                      <span class="list-row__main"><span class="list-row__title">${h.name}</span></span>
                      <span class="list-row__tail">${h.name===H.location.name?"当前":""}</span>
                    </button>`).join("")}
              </div>`).join("")}
        </div>`,{el:u,close:m}=Ee({title:"切换城市",body:c}),d=async p=>{Ze(p),m(),W(`已切换到 ${p.name}`),await a(!0)};u.addEventListener("click",p=>{const h=p.target.closest("[data-city]");h&&d(JSON.parse(h.dataset.city))});const l=async()=>{const p=u.querySelector("#citySearch").value.trim();if(!p)return;const h=u.querySelector("#cityList");h.innerHTML='<div class="loading-inline"><span class="spinner"></span>搜索中…</div>';const f=await Na(p),b=f.length?f:_t.filter(v=>v.name.includes(p)).map(v=>({...v,admin:v.group}));if(!b.length){h.innerHTML=`<div class="empty"><div class="empty__title">没有找到「${A(p)}」</div><div class="empty__desc">试试更短的关键词，或在设置中检查天气 API Host</div></div>`;return}h.innerHTML=b.map(v=>`<button class="list-row" type="button" data-city='${JSON.stringify({name:v.name,lat:Number(v.lat),lon:Number(v.lon)})}'>
              <span class="list-row__main">
                <span class="list-row__title">${A(v.name)}</span>
                <span class="list-row__sub">${A(v.admin||"")}</span>
              </span>
              <span class="list-row__tail">${x("chevronRight",15)}</span>
            </button>`).join("")};u.querySelector("#citySearchBtn").addEventListener("click",l),u.querySelector("#citySearch").addEventListener("keydown",p=>{p.key==="Enter"&&l()})},i=async()=>{const o=ot("正在定位…",{duration:1500});try{const c=await gs(),u=vs(c.lat,c.lon);Ze({name:u.name,lat:c.lat,lon:c.lon}),W(`已定位到 ${u.name} 附近`),await a(!0)}catch(c){dt(c.message)}finally{o?.()}};e.addEventListener("click",async o=>{const c=o.target.closest("[data-action]");c&&(c.dataset.action==="refresh"&&(c.style.transform="rotate(360deg)",c.style.transition="transform .6s",setTimeout(()=>c.style.transform="",620),await a(!0)),c.dataset.action==="city"&&s(),c.dataset.action==="locate"&&i())});const r=B.on("weather:change",n);return await a(),()=>r()},onShow(){ft().catch(()=>{})}},Q=1080,V=1350,J={skyTop:"#0b1a13",skyMid:"#1d3a2a",skyLow:"#5c6244",dawnSoft:"#f6d3a0",sun:"#fff2d0",ridgeMid:"#122a1d",ridgeNear:"#0a1710",ink:"#f2f7f2",inkSoft:"rgba(242,247,242,0.72)",inkFaint:"rgba(242,247,242,0.42)"},Je='"Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", "STSong", serif',St='"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';function tn(e,t,n,a,s,i){e.beginPath(),e.moveTo(t+i,n),e.arcTo(t+a,n,t+a,n+s,i),e.arcTo(t+a,n+s,t,n+s,i),e.arcTo(t,n+s,t,n,i),e.arcTo(t,n,t+a,n,i),e.closePath()}function ye(e,t,n,a,s=42){const i=[];let r=e;const o=()=>(r=(r*9301+49297)%233280,r/233280);for(let c=0;c<=s;c++){const u=c/s,m=t-n*(.55*Math.sin(u*Math.PI*a+e)+.3*Math.sin(u*Math.PI*a*2.3+e*1.7)+.15*(o()-.5));i.push([u,m])}return i}function we(e,t,n,a,s){e.beginPath(),e.moveTo(0,s),t.forEach(([i,r])=>e.lineTo(i*a,r*s)),e.lineTo(a,s),e.closePath(),e.fillStyle=n,e.fill()}function ws(e,t,n){const a=[];let s="";for(const i of t){const r=s+i;e.measureText(r).width>n&&s?(a.push(s),s=i):s=r}return s&&a.push(s),a}function en(e,t,n,a="  ·  "){const s=t.filter(Boolean);for(;s.length>1&&e.measureText(s.join(a)).width>n;)s.pop();return s.join(a)}function Tn({narrative:e,mode:t="hike",probability:n=null,sourceLabel:a=""}){const s=document.createElement("canvas");s.width=Q,s.height=V;const i=s.getContext("2d"),r=e?.meta||{},o=i.createLinearGradient(0,0,0,V);o.addColorStop(0,J.skyTop),o.addColorStop(.42,J.skyMid),o.addColorStop(.66,J.skyLow),o.addColorStop(.78,"#c98a54"),o.addColorStop(1,"#20301f"),i.fillStyle=o,i.fillRect(0,0,Q,V);const c=Q*.7,u=V*.5,m=i.createRadialGradient(c,u,10,c,u,Q*.62);m.addColorStop(0,"rgba(255,240,205,0.95)"),m.addColorStop(.12,"rgba(246,196,132,0.55)"),m.addColorStop(.42,"rgba(233,169,94,0.18)"),m.addColorStop(1,"rgba(233,169,94,0)"),i.fillStyle=m,i.fillRect(0,0,Q,V),i.beginPath(),i.arc(c,u,54,0,Math.PI*2),i.fillStyle=J.sun,i.fill();for(let w=0;w<4;w++){const C=V*(.62+w*.035),_=i.createLinearGradient(0,C-40,0,C+40);_.addColorStop(0,"rgba(255,238,214,0)"),_.addColorStop(.5,`rgba(255,238,214,${.16-w*.03})`),_.addColorStop(1,"rgba(255,238,214,0)"),i.fillStyle=_,i.fillRect(0,C-40,Q,80)}we(i,ye(3.1,.72,.1,1.6),"rgba(38,66,46,0.85)",Q,V),we(i,ye(7.7,.8,.12,2.1),J.ridgeMid,Q,V),we(i,ye(12.3,.9,.1,2.8),J.ridgeNear,Q,V);const d=i.createRadialGradient(Q/2,V*.45,V*.25,Q/2,V*.45,V*.78);if(d.addColorStop(0,"rgba(0,0,0,0)"),d.addColorStop(1,"rgba(5,12,8,0.55)"),i.fillStyle=d,i.fillRect(0,0,Q,V),i.font=`500 26px ${St}`,i.fillStyle=J.inkSoft,i.textAlign="left",i.textBaseline="middle",i.fillText("晓山青 · Viridiore",72,78),i.font=`400 22px ${St}`,i.fillStyle="rgba(242,247,242,0.34)",i.textAlign="right",i.fillText(r.weather?`${r.weather}${r.temp!==void 0?` ${r.temp}℃`:""}`:"",Q-72,78),Number.isFinite(n)){i.textAlign="left",i.font=`600 30px ${St}`;const w=`${t==="stars"?"星空":t==="sunrise"?"日出":"云海"} ${n}%`,C=i.measureText(w).width+52;i.fillStyle="rgba(12,25,18,0.42)",tn(i,72,122,C,62,31),i.fill(),i.strokeStyle="rgba(246,211,160,0.4)",i.lineWidth=1.5,i.stroke(),i.fillStyle=J.dawnSoft,i.fillText(w,98,154)}const l=72,p=Q-l*2,h=V-62;i.textAlign="left",i.textBaseline="alphabetic",i.fillStyle=J.ink,i.font=`300 126px ${Je}`;const f=V-372;i.fillText(r.time||"--:--",l,f),i.font=`400 27px ${St}`,i.fillStyle=J.inkSoft;const b=[];r.place&&b.push(r.place),r.elevation&&b.push(`海拔 ${r.elevation} 米`),e?.detail&&b.push(e.detail);const v=f+58;i.fillText(en(i,b,p),l,v),i.font=`400 37px ${Je}`,i.fillStyle=J.ink;const N=ws(i,e?.headline||"",p).slice(0,3),k=54,L=v+60;N.forEach((w,C)=>i.fillText(w,l,L+C*k));const $=L+(N.length-1)*k+58;if(e?.tags?.length&&$<h-34){let w=l;i.font=`500 22px ${St}`,e.tags.slice(0,3).forEach(C=>{const _=i.measureText(C).width+34;i.strokeStyle="rgba(242,247,242,0.28)",i.lineWidth=1.2,tn(i,w,$-30,_,44,22),i.stroke(),i.fillStyle=J.inkSoft,i.fillText(C,w+17,$),w+=_+14})}i.font=`400 20px ${St}`,i.fillStyle=J.inkFaint;const T=en(i,[r.coord,a||"离线记录"],p*.6);return i.fillText(T,l,h),i.textAlign="right",i.fillText(r.date||"",Q-l,h),s}function Pn(e){return new Promise((t,n)=>{e.toBlob?e.toBlob(a=>a?t(a):n(new Error("导出失败")),"image/png"):n(new Error("当前环境不支持导出图片"))})}async function ee(e,t="xiaoshanqing.png"){const n=await Pn(e),a=URL.createObjectURL(n),s=document.createElement("a");return s.href=a,s.download=t,document.body.appendChild(s),s.click(),s.remove(),setTimeout(()=>URL.revokeObjectURL(a),4e3),n}async function Cn(e,{title:t,text:n}={}){if(!navigator.share||!navigator.canShare)return!1;try{const a=await Pn(e),s=new File([a],"xiaoshanqing.png",{type:"image/png"});return navigator.canShare({files:[s]})?(await navigator.share({files:[s],title:t,text:n}),!0):!1}catch(a){return a?.name==="AbortError"}}const Pe=34,nn=2*Math.PI*Pe;function an(e){const t=nn*(1-e/100),n=e>=72?"#f0bb7f":e>=55?"#e5a457":e>=38?"#9dbd9f":"#7d8f83";return`<svg width="84" height="84" viewBox="0 0 84 84">
    <circle cx="42" cy="42" r="${Pe}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="5"/>
    <circle cx="42" cy="42" r="${Pe}" fill="none" stroke="${n}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${nn}" stroke-dashoffset="${t}" style="transition:stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)"/>
  </svg>`}const _s=()=>new Date().toISOString().slice(0,10),xs={id:"chase",title:"追光",icon:"sunrise",template(){const e=q();return`
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
        ${["cloudsea","sunrise","stars"].map((t,n)=>`<button type="button" data-mode="${t}" class="${n===0?"is-active":""}">${et[t].name}</button>`).join("")}
      </div>

      <div class="chase-hero" id="chaseHero">
        <div class="chase-hero__glow"></div>
        <div class="chase-hero__top">
          <div>
            <div class="chase-mountain__name" id="chaseName">${e.name}</div>
            <div class="chase-mountain__meta" id="chaseMeta">海拔 ${e.elevation}m · ${e.area}</div>
          </div>
          <div class="chase-score">
            <div class="chase-score__ring" id="chaseRing">${an(0)}<div class="chase-score__prob" id="chaseProb">--</div></div>
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
    `},async mount(e){const t=p=>e.querySelector(p);let n="cloudsea",a=null,s=null,i={offset:0,n:0},r=!1;const o=new URLSearchParams(location.hash.split("?")[1]||"").get("mode");o&&et[o]&&(n=o,e.querySelectorAll("[data-mode]").forEach(p=>p.classList.toggle("is-active",p.dataset.mode===n)));const c=()=>{if(!a||!s)return;const p=q();t("#chaseName").textContent=p.name,t("#chaseMeta").textContent=`海拔 ${p.elevation}m · ${p.area}`;const h=s.ranked[0];if(!h)return;t("#chaseRing").innerHTML=an(h.probability);const f=document.createElement("div");f.className="chase-score__prob",f.id="chaseProb",f.innerHTML=`${h.probability}<small>%</small>`,t("#chaseRing").appendChild(f),t("#chaseGrade").textContent=`${et[n].name} · ${h.grade.label}`;const b=h.day.dateObj instanceof Date?h.day.dateObj:new Date(h.day.date),v=xt(b,p.lat,p.lon),N=ke(b,p.lat);t("#chaseBestK").textContent=n==="stars"?"最佳夜空":`${Ye(h.index,h.day)} · ${Z(v.sunrise)} 前后`,t("#chaseBest").textContent=`${h.probability}% · ${h.verdict}`,t("#chaseSentence").textContent=$n(h,n,p);const k=[...s.all];t("#chaseDays").innerHTML=k.map(w=>{const C=w.index===h.index,_=Ye(w.index,w.day);return`<div class="chase-day ${C?"is-best":""}">
            <span class="chase-day__date">${_}<small>${String(w.day.date).slice(5)}</small></span>
            <span class="chase-day__icon">${Ut(w.day.codeDay,22)}</span>
            <span class="chase-day__bar"><span style="width:${w.probability}%"></span></span>
            <span class="chase-day__score ${w.probability>=55?"is-high":""}">${w.probability}%</span>
          </div>`}).join(""),t("#chaseWindowDesc").textContent=`${et[n].name} · 基准率 ${h.baseRate}% · ${a.providerName||"实时预报"}`,s.all[0].index===0?s.all[0].factors:h.factors;const L=s.all.find(w=>w.index===0)||h;t("#chaseEvidenceDesc").textContent=`以${L.index===0?"今天":"最佳日"}为例，共 ${L.factors.length} 项因子`,t("#chaseFactors").innerHTML=`<div class="factor-list">
        ${L.factors.map(w=>`<div class="factor ${w.tone}">
              <span class="factor__sign">${w.tone==="pro"?"+":"−"}</span>
              <span class="factor__main">
                <span class="factor__head"><b>${A(w.label)}</b><em>${A(String(w.value))}</em></span>
                <span class="factor__detail">${A(w.detail)}</span>
              </span>
              <span class="factor__delta">${w.delta>0?"+":""}${w.delta.toFixed(1)}</span>
            </div>`).join("")}
      </div>`;const y=Jt(L.day,p.elevation);t("#chaseMoon").textContent=a.moon?a.moon.phaseName:"--",t("#chaseSunrise").textContent=v.sunrise?Z(v.sunrise):"--:--",t("#chaseSunset").textContent=v.sunset?Z(v.sunset):"--:--",t("#chaseAzimuth").textContent=`${Math.round(N)}°`,t("#chaseSlope").textContent=Gt(N),t("#chaseRoute").textContent=`${p.route.distance} km / 爬升 ${p.route.ascent} m / 约 ${p.route.hours} h`,t("#chaseSeason").textContent=p.season;const $=L.confidence;t("#chaseFoot").innerHTML=`模型：月度基准率 + 云层高度（LCL）等 ${L.factors.length} 项物理证据。置信度 <b>${$.label}</b>（${$.hint}）${i.n?`；已用你 ${i.n} 次反馈校准（偏移 ${i.offset.toFixed(2)}）`:""}${y!=null?`。山顶约 ${y} ℃`:""}。`;const T=Mn({all:s.all,mode:n,todayProb:s.all[0]?.probability});s.all[0]&&s.all[0].probability<50&&T&&(t("#chaseSentence").textContent+=` ${T.text}`)},u=async(p=!1)=>{if(r)return;r=!0;const h=q();t("#chaseWindowDesc").textContent="正在获取山区天气…";try{i=await te(h.id,n),a=await _n({lat:h.lat,lon:h.lon,name:h.name,force:p}),s=Xt(a.daily,n,{mountain:h,source:a.source,calibration:i}),c()}catch(f){dt(f.message||"数据加载失败")}finally{r=!1}},m=()=>{const p=q(),h=s.ranked[0],f=h.day.dateObj instanceof Date?h.day.dateObj:new Date(h.day.date),b=xt(f,p.lat,p.lon),v=ke(f,p.lat),N=Jt(h.day,p.elevation),k={headline:`${f.getMonth()+1} 月 ${f.getDate()} 日 ${Z(b.sunrise)}，${p.name}${Gt(v)}，看到${et[n].name}概率 ${h.probability}%。`,detail:`山顶约 ${N} ℃`,tags:[et[n].name,`${h.probability}%`,h.grade.label],meta:{date:Tt(f),time:Z(b.sunrise),place:p.name,elevation:p.elevation,coord:`${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`,temp:N,weather:Gt(v)}},L=Tn({narrative:k,mode:n,probability:h.probability,sourceLabel:`${a.providerName||"实时预报"} · ${Z(a.updatedAt)} 更新`});ae({title:"预测卡",desc:"明天带着这张图上山，回来对照",wide:!0,body:'<div class="card-preview"><canvas id="cardCanvas"></canvas></div>',actions:[{label:"分享",variant:"primary",close:!1,onClick:async()=>{await Cn(L,{title:"晓山青 · 预测卡",text:k.headline})||(await ee(L,`晓山青-预测-${h.day.date}.png`),W("已保存图片"))}},{label:"保存图片",close:!1,onClick:async()=>{await ee(L,`晓山青-预测-${h.day.date}.png`),W("已保存图片")}}],onMount:y=>{const $=y.querySelector("#cardCanvas");$&&($.width=L.width,$.height=L.height,$.getContext("2d").drawImage(L,0,0))}})},d=async p=>{const h=s.all.find(f=>f.index===0);h&&(await Ua({mountainId:q().id,mode:n,date:_s(),predicted:h.probability,observed:p,source:a.source}),i=await te(q().id,n),s=Xt(a.daily,n,{mountain:q(),source:a.source,calibration:i}),c(),W(p?"记下了，恭喜看到":"记下了，模型会往下修正"))},l=()=>{const p=`<div class="list">
        ${$t.map(b=>`<button class="list-row" type="button" data-mountain="${b.id}">
            <span class="list-row__icon">${x("mountain",18)}</span>
            <span class="list-row__main">
              <span class="list-row__title">${b.name} <span class="muted" style="font-weight:400">${b.elevation}m</span></span>
              <span class="list-row__sub">${b.area} · ${b.tags.join(" / ")}</span>
            </span>
            <span class="list-row__tail">${b.id===H.mountainId?"当前":""}</span>
          </button>`).join("")}
      </div>`,{el:h,close:f}=Ee({title:"选择山峰",body:p});h.addEventListener("click",b=>{const v=b.target.closest("[data-mountain]");v&&(Ne(v.dataset.mountain),f(),u(!0))})};return e.addEventListener("click",p=>{const h=p.target.closest("[data-mode]");if(h){n=h.dataset.mode,e.querySelectorAll("[data-mode]").forEach(v=>v.classList.toggle("is-active",v===h)),u(!1);return}const f=p.target.closest("[data-feedback]");if(f){d(f.dataset.feedback==="1");return}const b=p.target.closest("[data-action]");if(b&&(b.dataset.action==="mountain"&&l(),b.dataset.action==="refresh"&&u(!0),b.dataset.action==="share")){if(!s)return ot("数据还没加载完");m()}}),await u(),()=>{}}},$s=256,Ln=$s;function Nt(e,t,n){const a=Ln*Math.pow(2,n),s=Math.max(-85.05,Math.min(85.05,e)),i=(t+180)/360*a,r=Math.sin(s*Math.PI/180),o=(.5-Math.log((1+r)/(1-r))/(4*Math.PI))*a;return{x:i,y:o}}function sn(e,t,n){const a=Ln*Math.pow(2,n),s=e/a*360-180,i=Math.PI-2*Math.PI*t/a;return{lat:180/Math.PI*Math.atan(.5*(Math.exp(i)-Math.exp(-i))),lon:s}}function Ms(e,t){return 156543.03392*Math.cos(e*Math.PI/180)/Math.pow(2,t)}class ks{constructor(t,n={}){this.canvas=t,this.ctx=t.getContext("2d"),this.options={minZoom:8,maxZoom:17,padding:36,onMarkerClick:null,onViewChange:null,...n},this.view={lat:22.55,lon:114.06,zoom:12},this.markers=[],this.path=[],this.selectedId=null,this.pointers=new Map,this.dragging=!1,this.lastPointer=null,this.pinchStart=null,this.raf=null,this.destroyed=!1,this._bind(),this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(t.parentElement||t),this.resize()}resize(){const t=this.canvas.parentElement||this.canvas,n=Math.min(window.devicePixelRatio||1,2.5),a=t.clientWidth,s=t.clientHeight;!a||!s||(this.width=a,this.height=s,this.canvas.width=Math.round(a*n),this.canvas.height=Math.round(s*n),this.canvas.style.width=`${a}px`,this.canvas.style.height=`${s}px`,this.ctx.setTransform(n,0,0,n,0,0),this.render())}setView(t){this.view={...this.view,...t},this.view.zoom=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom)),this.render()}setMarkers(t=[]){this.markers=t,this.render()}setPath(t=[]){this.path=t,this.render()}select(t){this.selectedId=t,this.render()}fitBounds(t,n=40){const a=(t||[]).filter(l=>Number.isFinite(l.lat)&&Number.isFinite(l.lon));if(!a.length)return;if(a.length===1){this.setView({lat:a[0].lat,lon:a[0].lon,zoom:14});return}let s=1/0,i=-1/0,r=1/0,o=-1/0;a.forEach(l=>{s=Math.min(s,l.lat),i=Math.max(i,l.lat),r=Math.min(r,l.lon),o=Math.max(o,l.lon)});const c={lat:(s+i)/2,lon:(r+o)/2};let u=this.view.zoom;const m=Math.max(40,this.width-n*2),d=Math.max(40,this.height-n*2);for(let l=this.options.maxZoom;l>=this.options.minZoom;l--){const p=Nt(i,r,l),h=Nt(s,o,l);if(Math.abs(h.x-p.x)<=m&&Math.abs(h.y-p.y)<=d){u=l;break}u=l}this.view={...c,zoom:u},this.render()}zoomBy(t){const n=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom+t));n!==this.view.zoom&&(this.view.zoom=n,this.render(),this.options.onViewChange?.(this.view))}project(t,n){const a=Nt(this.view.lat,this.view.lon,this.view.zoom),s=Nt(t,n,this.view.zoom);return{x:s.x-a.x+this.width/2,y:s.y-a.y+this.height/2}}unproject(t,n){const a=Nt(this.view.lat,this.view.lon,this.view.zoom);return sn(a.x+t-this.width/2,a.y+n-this.height/2,this.view.zoom)}_bind(){const t=this.canvas;t.style.touchAction="none",this._onPointerDown=n=>{if(t.setPointerCapture?.(n.pointerId),this.pointers.set(n.pointerId,{x:n.offsetX,y:n.offsetY}),this.pointers.size===2){const[a,s]=[...this.pointers.values()];this.pinchStart={dist:Math.hypot(a.x-s.x,a.y-s.y),zoom:this.view.zoom}}this.dragging=!0,this.moved=0,this.lastPointer={x:n.offsetX,y:n.offsetY}},this._onPointerMove=n=>{if(!this.pointers.has(n.pointerId))return;if(this.pointers.set(n.pointerId,{x:n.offsetX,y:n.offsetY}),this.pointers.size===2&&this.pinchStart){const[o,c]=[...this.pointers.values()],u=Math.hypot(o.x-c.x,o.y-c.y),m=u/(this.pinchStart.dist||u),d=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.pinchStart.zoom+Math.log2(m)));this.view.zoom=d,this.render();return}if(!this.dragging||!this.lastPointer)return;const a=n.offsetX-this.lastPointer.x,s=n.offsetY-this.lastPointer.y;this.moved+=Math.abs(a)+Math.abs(s),this.lastPointer={x:n.offsetX,y:n.offsetY};const i=Nt(this.view.lat,this.view.lon,this.view.zoom),r=sn(i.x-a,i.y-s,this.view.zoom);this.view.lat=Math.max(-84,Math.min(84,r.lat)),this.view.lon=r.lon,this.scheduleRender()},this._onPointerUp=n=>{this.pointers.delete(n.pointerId),this.pointers.size<2&&(this.pinchStart=null),this.pointers.size===0&&(this.dragging=!1,this.lastPointer=null,this.moved<6&&this._hitTest(n.offsetX,n.offsetY),this.options.onViewChange?.(this.view))},this._onWheel=n=>{n.preventDefault();const a=n.deltaY>0?-.5:.5,s=this.unproject(n.offsetX,n.offsetY),i=Math.max(this.options.minZoom,Math.min(this.options.maxZoom,this.view.zoom+a));if(i===this.view.zoom)return;this.view.zoom=i;const r=this.unproject(n.offsetX,n.offsetY);this.view.lat-=r.lat-s.lat,this.view.lon-=r.lon-s.lon,this.render(),this.options.onViewChange?.(this.view)},t.addEventListener("pointerdown",this._onPointerDown),t.addEventListener("pointermove",this._onPointerMove),t.addEventListener("pointerup",this._onPointerUp),t.addEventListener("pointercancel",this._onPointerUp),t.addEventListener("pointerleave",this._onPointerUp),t.addEventListener("wheel",this._onWheel,{passive:!1})}_hitTest(t,n){const a=[...this.markers].reverse().find(s=>{const i=this.project(s.lat,s.lon);return Math.hypot(i.x-t,i.y-n)<22});a&&(this.selectedId=a.id,this.render(),this.options.onMarkerClick?.(a))}scheduleRender(){this.raf||(this.raf=requestAnimationFrame(()=>{this.raf=null,this.render()}))}colors(){const t=getComputedStyle(document.documentElement),n=(a,s)=>t.getPropertyValue(a).trim()||s;return{moss:n("--moss-400","#649776"),mossDeep:n("--moss-600","#326046"),dawn:n("--dawn-400","#e5a457"),danger:n("--danger","#c04b40"),ink:n("--ink","#16261d"),text:n("--ink-2","#4c6156")}}render(){if(this.destroyed||!this.width)return;const{ctx:t,width:n,height:a}=this,s=this.colors();t.clearRect(0,0,n,a);const i=t.createLinearGradient(0,0,n,a);i.addColorStop(0,"#0d1d15"),i.addColorStop(.55,"#12291d"),i.addColorStop(1,"#0a1710"),t.fillStyle=i,t.fillRect(0,0,n,a),t.save(),t.globalAlpha=.5,[{x:n*.24,y:a*.32,r:a*.42,color:"rgba(63,107,76,0.28)"},{x:n*.74,y:a*.62,r:a*.5,color:"rgba(43,84,60,0.3)"},{x:n*.55,y:a*.15,r:a*.3,color:"rgba(90,120,80,0.16)"}].forEach(l=>{const p=t.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);p.addColorStop(0,l.color),p.addColorStop(1,"transparent"),t.fillStyle=p,t.beginPath(),t.arc(l.x,l.y,l.r,0,Math.PI*2),t.fill()}),t.restore();const o=64,c=this.project(this.view.lat,this.view.lon);t.strokeStyle="rgba(255,255,255,0.045)",t.lineWidth=1;const u=(c.x%o+o)%o,m=(c.y%o+o)%o;for(let l=u;l<n;l+=o)t.beginPath(),t.moveTo(Math.round(l)+.5,0),t.lineTo(Math.round(l)+.5,a),t.stroke();for(let l=m;l<a;l+=o)t.beginPath(),t.moveTo(0,Math.round(l)+.5),t.lineTo(n,Math.round(l)+.5),t.stroke();if(this.path.length>1){const l=this.path.map(b=>this.project(b.lat,b.lon)),p=(b,v,N)=>{t.save(),t.lineJoin="round",t.lineCap="round",t.lineWidth=b,t.strokeStyle=v,N&&(t.shadowColor=v,t.shadowBlur=N),t.beginPath(),l.forEach((k,L)=>L===0?t.moveTo(k.x,k.y):t.lineTo(k.x,k.y)),t.stroke(),t.restore()};p(9,"rgba(229,164,87,0.16)",0),p(4,s.dawn,8),p(1.4,"rgba(255,240,215,0.85)",0);const h=l[0],f=l[l.length-1];this._dot(h.x,h.y,5,"#8fd6a8"),this._dot(f.x,f.y,6,"#f0b268")}this._labelRects=[],this.markers.forEach(l=>{const p=this.project(l.lat,l.lon);p.x<-60||p.y<-60||p.x>n+60||p.y>a+60||this._marker(p,l)}),this._scaleBar(s);const d=t.createRadialGradient(n/2,a/2,Math.min(n,a)*.32,n/2,a/2,Math.max(n,a)*.78);d.addColorStop(0,"transparent"),d.addColorStop(1,"rgba(3,10,6,0.5)"),t.fillStyle=d,t.fillRect(0,0,n,a)}_dot(t,n,a,s){const{ctx:i}=this;i.beginPath(),i.arc(t,n,a+3,0,Math.PI*2),i.fillStyle="rgba(8,20,13,0.55)",i.fill(),i.beginPath(),i.arc(t,n,a,0,Math.PI*2),i.fillStyle=s,i.fill(),i.lineWidth=1.4,i.strokeStyle="rgba(255,255,255,0.85)",i.stroke()}_marker(t,n){const{ctx:a}=this,s=n.id===this.selectedId,i=n.color||"#e5a457";if(n.kind==="self"){const o=performance.now()%2e3/2e3;a.beginPath(),a.arc(t.x,t.y,10+o*20,0,Math.PI*2),a.fillStyle=`rgba(127,211,154,${.24*(1-o)})`,a.fill()}if(a.beginPath(),a.arc(t.x,t.y,s?8:6.5,0,Math.PI*2),a.fillStyle=i,a.fill(),a.lineWidth=2,a.strokeStyle="rgba(255,255,255,0.92)",a.stroke(),s&&(a.beginPath(),a.arc(t.x,t.y,15,0,Math.PI*2),a.strokeStyle="rgba(255,255,255,0.5)",a.lineWidth=1.2,a.stroke()),n.label&&(s||this.markers.length<=3||this.view.zoom>=13.2)&&this._labelRects.length<6){a.font=`600 ${10.5}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;const u=a.measureText(n.label).width+12,m=18,d=t.x-u/2,l=t.y-10-m;if(this._labelRects.some(f=>d<f.x+f.w+3&&d+u>f.x-3&&l<f.y+f.h+3&&l+m>f.y-3)&&!s)return;this._labelRects.push({x:d,y:l,w:u,h:m}),a.beginPath();const h=6;a.moveTo(d+h,l),a.arcTo(d+u,l,d+u,l+m,h),a.arcTo(d+u,l+m,d,l+m,h),a.arcTo(d,l+m,d,l,h),a.arcTo(d,l,d+u,l,h),a.closePath(),a.fillStyle=s?"rgba(229,164,87,0.94)":"rgba(9,22,15,0.8)",a.fill(),a.fillStyle=s?"#2c1d0c":"#e8f2ea",a.textAlign="center",a.textBaseline="middle",a.fillText(n.label,t.x,l+m/2)}}_scaleBar(t){const{ctx:n,width:a,height:s}=this,i=Ms(this.view.lat,this.view.zoom),o=i*80,c=[10,20,50,100,200,500,1e3,2e3,5e3,1e4,2e4,5e4].find(l=>l>=o/2)||5e4,u=c/i,m=14,d=s-18;n.strokeStyle="rgba(255,255,255,0.5)",n.lineWidth=1.5,n.beginPath(),n.moveTo(m,d-5),n.lineTo(m,d),n.lineTo(m+u,d),n.lineTo(m+u,d-5),n.stroke(),n.font='10px -apple-system, "PingFang SC", sans-serif',n.fillStyle="rgba(230,240,232,0.72)",n.textAlign="left",n.textBaseline="bottom",n.fillText(c>=1e3?`${c/1e3} km`:`${c} m`,m+2,d-6)}destroy(){this.destroyed=!0,cancelAnimationFrame(this.raf),this.resizeObserver?.disconnect();const t=this.canvas;t.removeEventListener("pointerdown",this._onPointerDown),t.removeEventListener("pointermove",this._onPointerMove),t.removeEventListener("pointerup",this._onPointerUp),t.removeEventListener("pointercancel",this._onPointerUp),t.removeEventListener("pointerleave",this._onPointerUp),t.removeEventListener("wheel",this._onWheel)}}class Ss{constructor(){this.worker=null,this.seq=0,this.pending=new Map}ensure(){return this.worker?this.worker:(this.worker=new Worker(new URL(""+new URL("trail.worker-BYy5JZCX.js",import.meta.url).href,import.meta.url),{type:"module"}),this.worker.addEventListener("message",t=>{const{id:n,ok:a,payload:s}=t.data||{},i=this.pending.get(n);i&&(this.pending.delete(n),a?i.resolve(s):i.reject(new Error(s?.message||"计算失败")))}),this.worker.addEventListener("error",t=>{console.warn("[worker]",t.message)}),this.worker)}post(t,n){const a=this.ensure(),s=++this.seq;return new Promise((i,r)=>{this.pending.set(s,{resolve:i,reject:r}),a.postMessage({id:s,type:t,payload:n}),setTimeout(()=>{this.pending.has(s)&&(this.pending.delete(s),r(new Error("计算超时")))},8e3)})}analyze(t){return this.post("ANALYZE",{points:t})}terminate(){this.worker?.terminate(),this.worker=null}}class Ns{constructor({onUpdate:t,onError:n,onStatus:a}={}){this.onUpdate=t||(()=>{}),this.onError=n||(()=>{}),this.onStatus=a||(()=>{}),this.worker=new Ss,this.points=[],this.stats=null,this.startedAt=null,this.running=!1,this.paused=!1,this.stopWatch=null,this.lastAnalyze=0,this.analyzeTimer=null}get isRunning(){return this.running}async start(){this.running||(this.points=[],this.startedAt=Date.now(),this.running=!0,this.paused=!1,this.onStatus({running:!0,paused:!1,pointCount:0}),this.stopWatch=Xe(t=>this.addPoint(t),t=>this.onError(t),{maximumAge:1e3}),this.analyzeTimer=setInterval(()=>this.recalc(),4e3))}pause(){this.running&&(this.paused=!0,this.stopWatch?.(),this.stopWatch=null,this.onStatus({running:!0,paused:!0,pointCount:this.points.length}))}resume(){!this.running||!this.paused||(this.paused=!1,this.stopWatch=Xe(t=>this.addPoint(t),t=>this.onError(t),{maximumAge:1e3}),this.onStatus({running:!0,paused:!1,pointCount:this.points.length}))}addPoint(t){if(this.paused||!Number.isFinite(t.lat)||!Number.isFinite(t.lon)||t.accuracy&&t.accuracy>80)return;const n=this.points[this.points.length-1];if(n&&t.ts-n.ts<800)return;this.points.push({lat:t.lat,lon:t.lon,altitude:t.altitude,accuracy:t.accuracy,speed:t.speed,heading:t.heading,ts:t.ts||Date.now()}),this.onStatus({running:!0,paused:!1,pointCount:this.points.length});const a=Date.now();this.points.length>1&&a-this.lastAnalyze>1500&&this.recalc()}async recalc(){if(this.points.length){this.lastAnalyze=Date.now();try{const t=this.running&&this.points.length===1?[this.points[0],{...this.points[0],ts:Date.now()}]:this.points,n=await this.worker.analyze(t);this.stats=n,this.onUpdate(n,this.points)}catch(t){console.warn("[tracker] 计算失败",t)}}}async stop(){return this.running?(this.running=!1,this.paused=!1,this.stopWatch?.(),this.stopWatch=null,clearInterval(this.analyzeTimer),this.analyzeTimer=null,this.points.length>=2?await this.recalc():this.points.length===1&&await this.recalc(),this.onStatus({running:!1,paused:!1,pointCount:this.points.length}),{stats:this.stats,points:this.points,startedAt:this.startedAt,endedAt:Date.now()}):null}discard(){this.stopWatch?.(),this.stopWatch=null,clearInterval(this.analyzeTimer),this.analyzeTimer=null,this.running=!1,this.paused=!1,this.points=[],this.stats=null,this.startedAt=null,this.onStatus({running:!1,paused:!1,pointCount:0})}destroy(){this.discard(),this.worker.terminate()}}function Ce(e,t,n="text/plain"){const a=t instanceof Blob?t:new Blob([t],{type:n}),s=URL.createObjectURL(a),i=document.createElement("a");i.href=s,i.download=e,document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(s),4e3)}function on(e){const t=Ts(e.name||"晓山青轨迹"),n=new Date(e.startedAt||Date.now()).toISOString(),a=(e.points||[]).map(s=>{const i=Number.isFinite(s.altitude)?`<ele>${s.altitude.toFixed(1)}</ele>`:"",r=s.ts?`<time>${new Date(s.ts).toISOString()}</time>`:"";return`      <trkpt lat="${s.lat.toFixed(6)}" lon="${s.lon.toFixed(6)}">${i}${r}</trkpt>`}).join(`
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
</gpx>`}function Ts(e){return String(e).replace(/[<>&'"]/g,t=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"})[t])}let X=null;function Ps(){const e=q(),t=[],n=160,a=Date.now()-3.2*36e5;for(let s=0;s<n;s++){const i=s/n,r=i*Math.PI*2.2,o=.012*(1-i*.35);t.push({lat:e.lat+Math.cos(r)*o+Math.sin(i*9)*.0012,lon:e.lon+Math.sin(r)*o*.9,altitude:e.elevation*.35+e.elevation*.6*Math.sin(Math.min(1,i*1.25)*Math.PI)+Math.sin(i*30)*6,accuracy:8,ts:a+s*72e3})}return t}const Cs={id:"trail",title:"轨迹",icon:"footprint",template(){return`
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
          <button class="btn btn--sm btn--ghost" type="button" data-action="demo" title="生成一段示例轨迹，仅用于体验卡片生成，不是你真实走过的路">载入示例轨迹</button>
        </div>
        <div class="stack" id="trailHistory">
          <div class="loading-inline"><span class="spinner"></span>读取中…</div>
        </div>
      </section>
    `},async mount(e,t){const n=y=>e.querySelector(y),a=n("#trailCanvas"),s=new ks(a,{onViewChange:()=>{}});s.setView({lat:q().lat,lon:q().lon,zoom:14}),s.setMarkers([]);const i=n("#trailProfile");let r=[],o=[],c=[],u=null,m=null;const d=()=>{const y=Math.min(window.devicePixelRatio||1,2),$=Math.max(80,i.clientWidth||i.parentElement.clientWidth-28),T=74;i.width=Math.max(1,$*y),i.height=T*y;const w=i.getContext("2d");if(w.setTransform(y,0,0,y,0,0),w.clearRect(0,0,$,T),!o.length){w.strokeStyle="rgba(125,143,131,0.4)",w.setLineDash([3,4]),w.beginPath(),w.moveTo(0,T/2),w.lineTo($,T/2),w.stroke(),w.setLineDash([]),n("#profileMin").textContent="--",n("#profileMax").textContent="--";return}const C=Math.min(...o),_=Math.max(...o),S=Math.max(1,_-C),g=$/Math.max(1,o.length-1),M=E=>T-8-(E-C)/S*(T-22),I=w.createLinearGradient(0,0,0,T);I.addColorStop(0,"rgba(229,164,87,0.34)"),I.addColorStop(1,"rgba(229,164,87,0.02)"),w.beginPath(),w.moveTo(0,T),o.forEach((E,F)=>w.lineTo(F*g,M(E))),w.lineTo($,T),w.closePath(),w.fillStyle=I,w.fill(),w.beginPath(),o.forEach((E,F)=>{const at=F*g,z=M(E);F===0?w.moveTo(at,z):w.lineTo(at,z)}),w.strokeStyle="#e5a457",w.lineWidth=1.8,w.lineJoin="round",w.stroke(),n("#profileMin").textContent=`${Math.round(C)} m`,n("#profileMax").textContent=`${Math.round(_)} m`},l=y=>{y&&(u=y,n("#stDistance").innerHTML=`${(y.distanceKm||0).toFixed(2)}<small>km</small>`,n("#stGain").innerHTML=`${y.elevation?.gain||0}<small>m</small>`,n("#stTime").textContent=Ia(y.duration||0),n("#stPace").innerHTML=y.avgPace?`${Math.floor(y.avgPace/6e4)}'${String(Math.floor(y.avgPace%6e4/1e3)).padStart(2,"0")}"<small>/km</small>`:"--")},p=y=>{const $=n("#trailState");y.running?($.classList.remove("is-idle"),$.innerHTML=`<span class="dot"></span>${y.paused?"已暂停":"记录中"}`):($.classList.add("is-idle"),$.innerHTML='<span class="dot"></span>待机'),n("#trailPointCount").textContent=`${y.pointCount||0} 个点`},h=(y,$)=>{r=$,o=y.profile||[];const T=y.simplified||$;s.setPath(T),s.setMarkers(T.length>1?[{id:"peak",lat:q().lat,lon:q().lon,label:q().name,color:"#8dbf9e",kind:"peak"}]:[]),n("#trailEmpty")?.classList.toggle("hidden",T.length>1),l(y),d()};X?(X.onUpdate=h,X.onStatus=y=>p(y)):X=new Ns({onUpdate:h,onStatus:y=>{p(y);const $=n("#recordBtn"),T=n("#pauseBtn");y.running?($.classList.add("is-recording"),$.innerHTML=`${x("square",16)} 结束并保存`,T.style.display=y.paused?"none":"grid",y.paused&&($.innerHTML=`${x("play",16)} 继续记录`)):($.classList.remove("is-recording"),$.innerHTML=`${x("play",17)} 开始记录`,T.style.display="none")},onError:y=>dt(y.message||"定位失败")});const f=async()=>{if(!navigator.geolocation){dt("当前环境不支持定位");return}try{s.setPath([]),o=[],d(),await X.start(),W("开始记录，请保持应用在前台以获得更准的轨迹"),s.fitBounds([{lat:q().lat,lon:q().lon}])}catch(y){dt(y.message)}},b=async()=>{const y=await X.stop(),$=y?.stats;if(!$||($.distance||0)<5){ot("轨迹太短，未保存"),X.discard();return}const T=await Bn({title:"保存轨迹",desc:`共 ${Te($.distance)}，累计爬升 ${$.elevation?.gain||0} m`,fields:[{name:"name",label:"轨迹名称",value:`${q().name} · ${new Date().getMonth()+1}/${new Date().getDate()}`,required:!0},{name:"note",label:"备注（可选）",type:"textarea",placeholder:"路况、天气、同行的人…"}],submitText:"保存"});if(!T){X.discard();return}await Ht.save({name:T.name,note:T.note,points:y.points,stats:$,startedAt:y.startedAt,endedAt:y.endedAt}),W("已保存到本机"),X.discard(),v()},v=async()=>{c=await Ht.list();const y=n("#trailHistory");if(!c.length){y.innerHTML=`<div class="card"><div class="empty">
          ${x("footprint",34)}
          <div class="empty__title">还没有轨迹</div>
          <div class="empty__desc">点上方「开始记录」实时采集，或载入示例查看效果</div>
        </div></div>`;return}y.innerHTML=c.map($=>{const T=$.stats||{};return`<div class="card" style="padding:12px">
            <div class="row row--between" style="align-items:flex-start">
              <div class="grow">
                <div style="font-size:14px;font-weight:600">${A($.name)}</div>
                <div class="trail-item__meta">
                  <span>${Tt($.startedAt)}</span>
                  <span>${(T.distanceKm||0).toFixed(2)} km</span>
                  <span>爬升 ${T.elevation?.gain||0} m</span>
                  <span>${Ha(($.endedAt||0)-($.startedAt||0))}</span>
                </div>
              </div>
              <div class="row" style="gap:2px">
                <button class="icon-btn" type="button" data-preview="${$.id}" title="查看">${x("map",17)}</button>
                <button class="icon-btn" type="button" data-gpx="${$.id}" title="导出 GPX">${x("download",17)}</button>
                <button class="icon-btn" type="button" data-share="${$.id}" title="分享">${x("share",17)}</button>
                <button class="icon-btn" type="button" data-del="${$.id}" title="删除">${x("trash",17)}</button>
              </div>
            </div>
          </div>`}).join("")},N=y=>{const $=q(),T=y.startedAt||Date.now(),C=new Date(T).getHours()<9?"dawn":"hike",_=os({trail:y,weather:H.weather,mountain:$,mode:C}),S=Tn({narrative:_,mode:"hike",sourceLabel:H.weather?.providerName?`${H.weather.providerName} · ${Z(H.weather.updatedAt)}`:"未取到天气"}),g=`晓山青-${y.startedAt?Tt(y.startedAt):"轨迹"}.png`;ae({title:"光之卡片",desc:"时间、坐标、海拔、当时的天气，都在这张图上",wide:!0,body:'<div class="card-preview"><canvas id="trailCardCanvas"></canvas></div>',actions:[{label:"分享",variant:"primary",close:!1,onClick:async()=>{await Cn(S,{title:"晓山青",text:_.headline})||(await ee(S,g),W("已保存图片"))}},{label:"保存图片",close:!1,onClick:async()=>{await ee(S,g),W("已保存图片")}}],onMount:M=>{const I=M.querySelector("#trailCardCanvas");I&&(I.width=S.width,I.height=S.height,I.getContext("2d").drawImage(S,0,0))}})};e.addEventListener("click",async y=>{const $=y.target.closest("[data-action], [data-preview], [data-gpx], [data-share], [data-del]");if(!$||$.id==="recordBtn")return;const T=$.dataset.action;if(T==="zoom-in"&&s.zoomBy(1),T==="zoom-out"&&s.zoomBy(-1),T==="fit"&&s.fitBounds(r.length?r:[{lat:q().lat,lon:q().lon}]),T==="pause"&&(X.paused?X.resume():X.pause()),T==="export"){if(!r.length){ot("当前没有可导出的轨迹");return}Ce(`track-${Date.now()}.gpx`,on({name:"晓山青轨迹",points:r,startedAt:r[0]?.ts}),"application/gpx+xml"),W("GPX 已导出")}if(T==="card"){if(!r.length){ot("还没有轨迹可以生成卡片");return}N(m||{name:`${q().name} 轨迹`,startedAt:r[0]?.ts||Date.now(),endedAt:r[r.length-1]?.ts||Date.now(),points:r,stats:u||{}})}if(T==="demo"){const g=Ps(),M=await new Promise(I=>{X.worker.analyze(g).then(I).catch(()=>I(null))});if(!M){dt("示例计算失败");return}r=g,o=M.profile||[],s.setPath(M.simplified||g),s.fitBounds(g),l(M),d(),n("#trailState").innerHTML='<span class="dot"></span>示例轨迹',n("#trailPointCount").textContent=`${M.pointCount} 个点`,W("已载入示例轨迹（不会保存）")}const w=$.dataset.preview;if(w){const g=c.find(M=>M.id===w);if(!g)return;m=g,r=g.points||[],o=g.stats?.profile||[],s.setPath(g.stats?.simplified||g.points||[]),s.fitBounds(g.points||[]),l(g.stats),d(),window.scrollTo({top:0,behavior:"smooth"})}const C=$.dataset.gpx;if(C){const g=c.find(M=>M.id===C);Ce(`${g.name||"trail"}.gpx`,on(g),"application/gpx+xml"),W("GPX 已导出")}const _=$.dataset.share;if(_){const g=c.find(M=>M.id===_);g&&N(g)}const S=$.dataset.del;S&&await $e({title:"删除这条轨迹？",desc:"删除后不可恢复，导出的 GPX 文件不受影响。",confirmText:"删除",danger:!0})&&(await Ht.remove(S),W("已删除"),v())}),n("#recordBtn").addEventListener("click",async()=>{X.isRunning?X.paused?X.resume():await b():await f()});const k=new ResizeObserver(()=>d());k.observe(i.parentElement);const L=B.on("trail:change",v);if(await v(),c.length){const y=c[0];m=y,r=y.points||[],o=y.stats?.profile||[],s.setPath(y.stats?.simplified||y.points||[]),s.fitBounds(y.points||[]),l(y.stats),d(),n("#trailState").innerHTML=`<span class="dot"></span>${y.name}`}return d(),()=>{L(),k.disconnect(),s.destroy()}}},Ls="modulepreload",Es=function(e,t){return new URL(e,t).href},rn={},As=function(t,n,a){let s=Promise.resolve();if(n&&n.length>0){let r=function(m){return Promise.all(m.map(d=>Promise.resolve(d).then(l=>({status:"fulfilled",value:l}),l=>({status:"rejected",reason:l}))))};const o=document.getElementsByTagName("link"),c=document.querySelector("meta[property=csp-nonce]"),u=c?.nonce||c?.getAttribute("nonce");s=r(n.map(m=>{if(m=Es(m,a),m in rn)return;rn[m]=!0;const d=m.endsWith(".css"),l=d?'[rel="stylesheet"]':"";if(!!a)for(let f=o.length-1;f>=0;f--){const b=o[f];if(b.href===m&&(!d||b.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${m}"]${l}`))return;const h=document.createElement("link");if(h.rel=d?"stylesheet":Ls,d||(h.as="script"),h.crossOrigin="",h.href=m,u&&h.setAttribute("nonce",u),document.head.appendChild(h),d)return new Promise((f,b)=>{h.addEventListener("load",f),h.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${m}`)))})}))}function i(r){const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=r,window.dispatchEvent(o),!o.defaultPrevented)throw r}return s.then(r=>{for(const o of r||[])o.status==="rejected"&&i(o.reason);return t().catch(i)})};function Ds(){const e=navigator.userAgent;return/Electron/i.test(e)?"Windows 桌面版（Electron）":/Android/i.test(e)?"Android":/iPhone|iPad/i.test(e)?"iOS":/Macintosh/i.test(e)?"macOS":"浏览器 / PWA"}const Is={id:"settings",title:"设置",icon:"settings",template(){const e=nt.all;return`
      <div class="page-head">
        <div>
          <h1 class="page-head__title">设置</h1>
          <p class="page-head__desc">当前数据来源：${nt.hasQWeather()?"Open-Meteo + 和风天气（预警 / 空气质量）":"Open-Meteo（免费，无需 Key）"}</p>
        </div>
      </div>

      <section class="section">
        <div class="settings-group">
          <div class="settings-group__title">和风天气 · 可选增强</div>
          <p class="field__hint" style="margin:-6px 0 14px">
            预报本身已经走 Open-Meteo，打开就是真实数据。这里填 Key 只为了两件 Open-Meteo 给不了的东西：
            <strong>中国气象局的气象预警</strong>，以及<strong>环境监测总站的实测 AQI</strong>。
            不填的话空气质量是 CAMS 模式估算值，通常比监测站实测偏高，尤其 SO₂ 和 NO₂。
          </p>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Key</span>
            <input class="input" id="qwKey" type="password" placeholder="粘贴你的和风天气 Key" value="${A(e.qweather.key||"")}" />
          </label>
          <label class="field" style="margin-bottom:14px">
            <span class="field__label">API Host</span>
            <input class="input" id="qwHost" type="text" placeholder="https://xxxxxxxx.re.qweatherapi.com" value="${A(e.qweather.host||"")}" />
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
              <div class="setting-row__desc" id="themeDesc">${mt.label()}</div>
            </div>
            <div class="segmented" id="themeSeg">
              ${["auto","light","dark"].map(n=>`<button type="button" data-theme-set="${n}" class="${mt.mode===n?"is-active":""}">${{auto:"自动",light:"浅色",dark:"深色"}[n]}</button>`).join("")}
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
          <div style="display:flex;justify-content:center;margin-bottom:10px">${hn(52)}</div>
          <div style="font-family:var(--font-display);font-size:20px;letter-spacing:.16em">晓山青</div>
          <div class="muted" style="font-size:11px;letter-spacing:.2em;margin-top:4px">VIRIDIORE</div>
          <div class="muted" style="font-size:12px;margin-top:14px">版本 v2.3.0 · ${Ds()}</div>
          <div class="muted" style="font-size:11px;margin-top:6px">不问天气好不好，只回答值不值得去</div>
        </div>
      </section>

      <p class="center muted" style="font-size:11px;padding:6px 0 10px">
        无痕山林 · 只带走照片，只留下脚印
      </p>
    `},async mount(e){const t=r=>e.querySelector(r),n=()=>{nt.set({qweather:{key:t("#qwKey").value.trim(),host:t("#qwHost").value.trim()||"https://devapi.qweather.com"}}),B.emit("config:change",nt.all)};e.querySelectorAll("input").forEach(r=>{r.addEventListener("change",()=>{n(),r.style.borderColor="var(--moss-400)",setTimeout(()=>r.style.borderColor="",700)})});const a=async()=>{const{total:r}=await ge();t("#fbCount").textContent=`${r} 条`,t("#fbSub").textContent=r<3?`已有 ${r} 条，满 3 条开始参与概率校准`:`已有 ${r} 条，已参与概率校准`};e.addEventListener("click",async r=>{const o=r.target.closest("[data-theme-set]");if(o){mt.set(o.dataset.themeSet),e.querySelectorAll("[data-theme-set]").forEach(u=>u.classList.toggle("is-active",u===o)),t("#themeDesc").textContent=mt.label();return}const c=r.target.closest("[data-action]");if(c)switch(c.dataset.action){case"test-weather":{if(n(),!nt.hasQWeather()){ot("请先填写 API Key");return}const u=c;u.disabled=!0,u.innerHTML='<span class="spinner"></span> 测试中';try{const m=await it.now(114.0579,22.5431);W(`连接成功：深圳 ${m.now.temp}℃ ${m.now.text}`),ft(!0).catch(()=>{})}catch(m){dt(`连接失败：${m.message}`)}finally{u.disabled=!1,u.innerHTML=`${x("activity",14)} 测试连接`}break}case"open-qw":window.open("https://console.qweather.com/","_blank","noopener");break;case"feedback":{const{rows:u}=await ge();if(!u.length){ot("还没有反馈样本。到追光页点「看到了 / 白跑一趟」");return}W(`共 ${u.length} 条样本，最近一条预测 ${u[u.length-1].predicted}%`);break}case"reset-calib":{if(await $e({title:"重置校准？",desc:"会清空所有追光反馈样本，概率回到未经校准的模型输出。轨迹不受影响。",confirmText:"重置",danger:!0})){const{idb:m}=await As(async()=>{const{idb:d}=await Promise.resolve().then(()=>Hn);return{idb:d}},void 0,import.meta.url);await m.clear("feedback").catch(()=>{}),Za(),a(),W("已重置")}break}case"export-data":{const[u,m]=await Promise.all([Ht.list(),ge()]);Ce(`xiaoshanqing-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({exportedAt:new Date().toISOString(),version:"2.3.0",trails:u,feedback:m.rows,prefs:ut.all},null,2),"application/json"),W("已导出 JSON 备份");break}case"install":{if(window.__installPrompt){window.__installPrompt.prompt();const u=await window.__installPrompt.userChoice;window.__installPrompt=null,t("#installState").textContent=u.outcome==="accepted"?"已发起安装":"已取消"}else window.matchMedia("(display-mode: standalone)").matches?W("已在独立窗口中运行"):ot("当前浏览器未提供安装入口：iOS 请用 Safari「添加到主屏幕」");break}case"clear":{await $e({title:"清除全部数据？",desc:"轨迹、追光反馈、缓存都会删除，且无法恢复。",confirmText:"确认清除",danger:!0})&&(await Rn(),W("已清除，正在重新加载"),setTimeout(()=>location.reload(),800));break}}});const s=t("#installState");s.textContent=window.__installPrompt?"可安装":window.matchMedia("(display-mode: standalone)").matches?"已安装":"不可用",a();const i=B.on("config:change",()=>{});return()=>i()}};[ps,xs,Cs,ys,Is].forEach(Gn);function Hs(){const e=document.getElementById("boot-splash");e&&(e.classList.add("is-hidden"),setTimeout(()=>e.remove(),600))}function Os(){!(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")||!("serviceWorker"in navigator)||window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(t=>console.warn("[sw] 注册失败",t))})}function Fs(){window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),window.__installPrompt=e})}async function Rs(){mt.init(),Fs();const e=document.getElementById("app"),t=Aa(e);Kn(t.pageRoot),ft().catch(n=>console.warn("[boot] 天气预取失败",n)),await Vn(t.pageRoot,"home"),Hs(),Os(),window.addEventListener("unhandledrejection",n=>{console.warn("[unhandledrejection]",n.reason)})}window.addEventListener("error",e=>{console.error("[global error]",e.error||e.message)});Rs().catch(e=>{console.error("[boot] 启动失败",e);const t=document.getElementById("boot-splash");t&&(t.innerHTML=`<div style="color:#fff;text-align:center;padding:24px">
    <div style="font-size:18px;margin-bottom:8px">应用启动失败</div>
    <div style="font-size:12px;opacity:.75;max-width:320px">${e.message}</div>
  </div>`),dt("应用启动失败，请刷新重试")});
