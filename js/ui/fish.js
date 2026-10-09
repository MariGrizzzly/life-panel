// Живое море в боковом меню: рыбы появляются в случайные моменты,
// плывут на разной глубине, с разной скоростью и по разным траекториям.
// Иногда останавливаются, разворачиваются, делают рывок. Всё на Web Animations.

const R = (a, b) => a + Math.random() * (b - a);
const pickW = (list) => {
  const sum = list.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * sum;
  for (const x of list) { if ((r -= x.w) <= 0) return x; }
  return list[list.length - 1];
};
let uid = 0;

// Все рыбы нарисованы мордой вправо. Хвост — группа .ftail (машет у основания).
const SPECIES = [
  {
    id: 'clown', w: 3, size: [46, 26], speed: [26, 44], depth: [0.65, 1], wag: [0.32, 0.45], moves: ['cross', 'turn', 'turn', 'dart'],
    svg: (k) => `<svg viewBox="0 0 60 34" width="100%" height="100%"><defs>
      <linearGradient id="c1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB15A"/><stop offset=".55" stop-color="#F2741C"/><stop offset="1" stop-color="#C9500E"/></linearGradient>
      <clipPath id="c2${k}"><ellipse cx="33" cy="17" rx="21" ry="11.5"/></clipPath></defs>
      <g class="ftail"><path d="M14 17 C 8 10 3 7 1 8 C 3 13 3 21 1 26 C 3 27 8 24 14 17 Z" fill="url(#c1${k})" stroke="#1B1410" stroke-width="1.1"/></g>
      <path d="M20 7 C 25 1 35 0 41 6 Z" fill="#F07A1A" stroke="#1B1410" stroke-width="1"/>
      <path d="M26 27 C 28 32 34 33 36 28 Z" fill="#F07A1A" stroke="#1B1410" stroke-width="1"/>
      <ellipse cx="33" cy="17" rx="21" ry="11.5" fill="url(#c1${k})"/>
      <g clip-path="url(#c2${k})">
        <path d="M22 0 C 18 10 18 24 22 34 L 28 34 C 24 24 24 10 28 0 Z" fill="#FFF" stroke="#1B1410" stroke-width="1.1"/>
        <path d="M37 0 C 34 10 34 24 37 34 L 42 34 C 39.5 24 39.5 10 42 0 Z" fill="#FFF" stroke="#1B1410" stroke-width="1.1"/>
        <path d="M12 0 L 15 0 C 13 12 13 22 15 34 L 12 34 Z" fill="#FFF"/>
        <ellipse cx="33" cy="9" rx="20" ry="4" fill="#FFF" opacity=".18"/>
      </g>
      <path d="M33 19 C 36 22 40 23 42 21 C 39 20 36 19 33 19 Z" fill="#F7871F" stroke="#1B1410" stroke-width=".8"/>
      <circle cx="47" cy="14" r="2.6" fill="#FFF"/><circle cx="47.6" cy="14" r="1.6" fill="#111"/></svg>`
  },
  {
    id: 'tang', w: 3, size: [52, 34], speed: [24, 40], depth: [0.6, 1], wag: [0.38, 0.5], moves: ['cross', 'cross', 'turn', 'dart'],
    svg: (k) => `<svg viewBox="0 0 62 40" width="100%" height="100%"><defs>
      <linearGradient id="t1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B9BFF"/><stop offset=".6" stop-color="#2A64DA"/><stop offset="1" stop-color="#1A47A8"/></linearGradient>
      <clipPath id="t2${k}"><path d="M14 20 C 18 6 34 3 46 8 C 55 12 59 17 59 21 C 57 26 50 33 38 35 C 26 36 16 30 14 20 Z"/></clipPath></defs>
      <g class="ftail"><path d="M15 20 C 9 14 5 10 1 9 C 3 15 3 25 1 31 C 5 30 9 26 15 20 Z" fill="#F6D23A"/></g>
      <path d="M18 9 C 26 1 42 0 50 7 C 40 5 28 6 18 12 Z" fill="#2A64DA"/><path d="M20 31 C 28 39 42 39 48 33 C 38 35 28 34 20 30 Z" fill="#2A64DA"/>
      <path d="M14 20 C 18 6 34 3 46 8 C 55 12 59 17 59 21 C 57 26 50 33 38 35 C 26 36 16 30 14 20 Z" fill="url(#t1${k})"/>
      <g clip-path="url(#t2${k})"><path d="M14 19 C 20 10 34 9 44 14 C 50 17 52 21 50 23 C 44 20 36 18 30 22 C 26 25 22 28 16 27 C 21 24 25 21 26 19 C 22 17 18 18 14 19 Z" fill="#0B1A3C"/>
        <ellipse cx="38" cy="10" rx="18" ry="4" fill="#FFF" opacity=".16"/></g>
      <path d="M16 22 L 21 20 L 20 24 Z" fill="#F6D23A"/>
      <circle cx="50" cy="16" r="2.4" fill="#0B1A3C"/><circle cx="50.7" cy="15.4" r=".7" fill="#FFF"/></svg>`
  },
  {
    id: 'butterfly', w: 2, size: [40, 34], speed: [20, 34], depth: [0.6, 1], wag: [0.3, 0.42], moves: ['turn', 'turn', 'cross'],
    svg: (k) => `<svg viewBox="0 0 50 42" width="100%" height="100%"><defs>
      <linearGradient id="b1${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF2A8"/><stop offset=".5" stop-color="#FFD53A"/><stop offset="1" stop-color="#F2B511"/></linearGradient></defs>
      <g class="ftail"><path d="M11 21 C 6 16 3 15 1 15 C 2 19 2 23 1 27 C 3 27 6 26 11 21 Z" fill="#F2C21A"/></g>
      <path d="M10 21 C 10 8 22 2 32 6 C 40 9 46 15 47 21 C 46 27 40 34 32 37 C 22 40 10 34 10 21 Z" fill="url(#b1${k})"/>
      <path d="M14 10 C 22 2 32 2 36 6 C 30 6 22 8 16 14 Z" fill="#F2B511"/>
      <path d="M33 8 C 36 14 36 28 33 35" stroke="#1B1B1B" stroke-width="2.6" fill="none" opacity=".85"/>
      <circle cx="17" cy="16" r="3" fill="#1B1B1B" opacity=".75"/>
      <path d="M44 20 L 49 21 L 44 22 Z" fill="#E09A0C"/>
      <circle cx="40" cy="18" r="2" fill="#111"/></svg>`
  },
  {
    id: 'angel', w: 2, size: [40, 50], speed: [16, 28], depth: [0.6, 0.95], wag: [0.45, 0.6], moves: ['turn', 'cross'],
    svg: (k) => `<svg viewBox="0 0 48 60" width="100%" height="100%"><defs>
      <linearGradient id="a1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8F1FA"/><stop offset="1" stop-color="#9FB6CC"/></linearGradient></defs>
      <g class="ftail"><path d="M12 30 C 7 25 3 24 1 25 C 2 28 2 32 1 35 C 3 36 7 35 12 30 Z" fill="#B8CCDE" opacity=".9"/></g>
      <path d="M14 26 C 16 14 24 4 36 0 C 33 8 32 15 33 21 Z" fill="url(#a1${k})"/>
      <path d="M14 34 C 16 46 24 56 36 60 C 33 52 32 45 33 39 Z" fill="url(#a1${k})"/>
      <path d="M11 30 C 11 20 20 15 30 17 C 38 19 44 25 45 30 C 44 35 38 41 30 43 C 20 45 11 40 11 30 Z" fill="url(#a1${k})"/>
      <path d="M24 8 C 21 20 21 40 24 54" stroke="#2B3440" stroke-width="2.4" fill="none" opacity=".75"/>
      <path d="M32 18 C 30 25 30 35 32 42" stroke="#2B3440" stroke-width="2" fill="none" opacity=".6"/>
      <path d="M30 34 C 28 42 26 50 22 56" stroke="#E8F1FA" stroke-width="1" fill="none" opacity=".8"/>
      <circle cx="39" cy="27" r="2" fill="#1A1F26"/></svg>`
  },
  {
    id: 'school', w: 3, size: [84, 44], speed: [34, 52], depth: [0.55, 0.9], wag: [0.22, 0.3], moves: ['cross', 'cross', 'dart'],
    svg: (k) => {
      const one = (x, y, d, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="fbob2" style="animation-delay:${d}s">
        <g class="ftail" style="animation-delay:${d}s"><path d="M6 5 L 0 1 L 1 5 L 0 9 Z" fill="#8FB0C8"/></g>
        <path d="M5 5 C 8 1 18 1 22 4 C 23 5 23 5 22 6 C 18 9 8 9 5 5 Z" fill="url(#s1${k})"/>
        <path d="M7 5 L 21 5" stroke="#FFF" stroke-width=".7" opacity=".7"/><circle cx="19" cy="4.4" r=".9" fill="#122"/></g></g>`;
      return `<svg viewBox="0 0 84 44" width="100%" height="100%"><defs>
        <linearGradient id="s1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E87A6"/><stop offset=".5" stop-color="#D6E6F2"/><stop offset="1" stop-color="#F4FAFF"/></linearGradient></defs>
        ${one(4, 6, 0)}${one(30, 0, 0.2, 0.9)}${one(56, 8, 0.4)}${one(18, 22, 0.1, 1.05)}${one(46, 26, 0.3, 0.95)}${one(62, 30, 0.5, 0.85)}${one(2, 32, 0.6, 0.9)}</svg>`;
    }
  },
  {
    id: 'turtle', w: 0.7, size: [70, 44], speed: [10, 16], depth: [0.55, 0.85], wag: [1.6, 2.2], moves: ['cross'],
    svg: (k) => `<svg viewBox="0 0 80 50" width="100%" height="100%"><defs>
      <radialGradient id="u1${k}" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#9BBF6A"/><stop offset=".7" stop-color="#5E8240"/><stop offset="1" stop-color="#3E5A2A"/></radialGradient></defs>
      <g class="ftail flipper"><path d="M46 30 C 52 38 58 46 52 48 C 46 46 42 38 40 31 Z" fill="#7FA05A"/></g>
      <path d="M14 26 L 4 24 L 8 30 Z" fill="#7FA05A"/>
      <path d="M22 30 C 18 38 12 42 10 40 C 12 36 16 32 20 28 Z" fill="#7FA05A"/>
      <ellipse cx="66" cy="24" rx="9" ry="6.5" fill="#86A863"/><circle cx="70" cy="22" r="1.3" fill="#1E2A14"/>
      <ellipse cx="38" cy="26" rx="26" ry="15" fill="url(#u1${k})"/>
      <path d="M38 12 L 30 20 L 34 32 L 44 32 L 48 20 Z M30 20 L 16 22 M48 20 L 60 22 M34 32 L 24 38 M44 32 L 52 38 M38 12 L 38 11" stroke="#2E4520" stroke-width="1.2" fill="none" opacity=".7"/>
      <g class="ftail flipper" style="animation-delay:-.4s"><path d="M48 22 C 56 14 66 8 64 4 C 58 4 50 12 46 20 Z" fill="#86A863"/></g></svg>`
  },
  {
    id: 'dolphin', w: 0.7, size: [110, 46], speed: [44, 64], depth: [0.45, 0.75], wag: [0.6, 0.8], moves: ['cross'], tilt: 22, wave: 34,
    svg: (k) => `<svg viewBox="0 0 120 50" width="100%" height="100%"><defs>
      <linearGradient id="d1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E87AE"/><stop offset=".55" stop-color="#8FB4D6"/><stop offset="1" stop-color="#E6F1FA"/></linearGradient></defs>
      <g class="ftail vert"><path d="M22 26 C 14 24 6 18 1 16 C 4 22 6 26 4 32 C 10 32 16 30 22 28 Z" fill="#6A92B8"/></g>
      <path d="M20 27 C 34 16 58 12 80 15 C 92 17 102 21 108 25 C 113 26 118 27 118 29 C 112 31 104 31 96 31 C 82 35 60 36 40 33 C 32 32 26 30 20 27 Z" fill="url(#d1${k})"/>
      <path d="M56 15 C 60 6 66 3 72 3 C 68 7 66 11 66 15 Z" fill="#5E87AE"/>
      <path d="M72 32 C 70 38 66 42 62 43 C 63 39 64 35 66 32 Z" fill="#7CA4C8"/>
      <path d="M44 31 C 64 33 86 32 104 29" stroke="#FFF" stroke-width="1.2" fill="none" opacity=".5"/>
      <circle cx="100" cy="23" r="1.6" fill="#0E1E3A"/></svg>`
  },
  {
    id: 'shark', w: 0.5, size: [130, 48], speed: [22, 30], depth: [0.4, 0.6], wag: [0.9, 1.2], moves: ['cross'], tilt: 6,
    svg: (k) => `<svg viewBox="0 0 130 48" width="100%" height="100%"><defs>
      <linearGradient id="h1${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3F6587"/><stop offset=".6" stop-color="#6E90AE"/><stop offset="1" stop-color="#C9D9E6"/></linearGradient></defs>
      <g class="ftail"><path d="M22 25 L 4 4 C 8 14 10 20 12 25 C 10 30 7 36 6 42 Z" fill="#3F6587"/></g>
      <path d="M18 25 C 34 15 64 12 92 15 C 108 17 120 21 128 26 C 118 30 104 32 88 32 C 64 35 36 33 18 25 Z" fill="url(#h1${k})"/>
      <path d="M58 15 L 66 0 L 74 15 Z" fill="#3F6587"/>
      <path d="M72 31 C 70 38 64 44 58 45 C 61 40 63 35 64 31 Z" fill="#4E7496"/>
      <path d="M98 22 L 98 28 M101 22 L 101 28 M104 22 L 104 27" stroke="#2D4A63" stroke-width=".8" opacity=".6"/>
      <circle cx="112" cy="22" r="1.4" fill="#0A1A2A"/></svg>`
  }
];

let timer = 0;
let last = '';

function seaBox() {
  const sea = document.querySelector('.sidebar .sea');
  if (!sea || !sea.offsetWidth) return null;
  return { sea, W: sea.offsetWidth, H: sea.offsetHeight };
}

// Траектория: список точек {x, y, t, f}, f — куда смотрит (1 вправо, -1 влево).
function route(sp, move, W, H, w, h, speed) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const xIn = dir > 0 ? -w - 10 : W + 10;
  const xOut = dir > 0 ? W + 10 : -w - 10;
  const yMin = H * 0.08, yMax = H * 0.9 - h;
  const clampY = (y) => Math.max(yMin, Math.min(yMax, y));
  let y = R(yMin, yMax);
  const pts = [{ x: xIn, y, t: 0, f: dir }];
  const add = (x, ny, v, f = pts[pts.length - 1].f) => {
    const p = pts[pts.length - 1];
    const dist = Math.hypot(x - p.x, ny - p.y);
    pts.push({ x, y: ny, t: p.t + dist / v, f });
  };
  const wave = sp.wave || 26;
  if (move === 'turn') {
    // заплывает, зависает, разворачивается и уплывает обратно
    const stopX = dir > 0 ? R(W * 0.25, W * 0.6) : R(W * 0.4, W * 0.75) - w;
    const mid = (xIn + stopX) / 2;
    add(mid, (y = clampY(y + R(-wave, wave))), speed);
    add(stopX, (y = clampY(y + R(-wave, wave))), speed * 0.6);
    const p = pts[pts.length - 1];
    pts.push({ x: p.x + dir * 3, y: y - 2, t: p.t + R(0.8, 2.2), f: dir });           // зависла
    const q = pts[pts.length - 1];
    pts.push({ x: q.x, y: q.y + 1, t: q.t + 0.45, f: -dir });                         // разворот
    add(stopX - dir * w * 0.8, (y = clampY(y + R(-wave, wave))), speed * 0.9, -dir);
    add(xIn, (y = clampY(y + R(-wave * 1.5, wave * 1.5))), speed * 1.1, -dir);
  } else {
    const n = 3 + Math.floor(Math.random() * 3);
    const dartAt = move === 'dart' ? 1 + Math.floor(Math.random() * (n - 1)) : -1;
    for (let i = 1; i <= n; i++) {
      const x = xIn + ((xOut - xIn) * i) / (n + 1);
      let v = speed * R(0.75, 1.25);
      if (i === dartAt) v = speed * 3.2;
      if (i === dartAt + 1) v = speed * 0.45;
      add(x, (y = clampY(y + R(-wave, wave))), v);
    }
    add(xOut, clampY(y + R(-wave, wave)), speed);
  }
  return pts;
}

function spawn(initial = false) {
  const box = seaBox();
  if (!box) return;
  const { sea, W, H } = box;
  if (sea.querySelectorAll('.fish').length >= 3) return;
  let sp;
  do sp = pickW(SPECIES); while (sp.id === last && Math.random() < 0.85);
  last = sp.id;
  const depth = R(...sp.depth);
  const w = sp.size[0] * depth * 1.2, h = sp.size[1] * depth * 1.2;
  const speed = R(...sp.speed) * (0.6 + depth * 0.5);
  const move = sp.moves[Math.floor(Math.random() * sp.moves.length)];
  const pts = route(sp, move, W, H, w, h, speed);
  const total = pts[pts.length - 1].t;
  const tiltMax = sp.tilt ?? 14;

  const el = document.createElement('div');
  el.className = 'fish';
  el.style.cssText = `width:${w}px;height:${h}px;opacity:${(0.3 + depth * 0.7).toFixed(2)};z-index:${Math.round(depth * 10)};` +
    (depth < 0.6 ? 'filter:saturate(.6) brightness(.85);' : '');
  const wag = R(...sp.wag).toFixed(2);
  el.innerHTML = `<div class="fbob" style="--wag:${wag}s;animation-duration:${R(2.2, 3.6).toFixed(2)}s">${sp.svg(++uid)}</div>`;
  sea.appendChild(el);

  const frames = pts.map((p, i) => {
    const nx = pts[Math.min(i + 1, pts.length - 1)], pv = pts[Math.max(i - 1, 0)];
    const dx = (nx.x - pv.x) || 1, dy = nx.y - pv.y;
    let a = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
    a = Math.max(-tiltMax, Math.min(tiltMax, a));
    return { offset: total ? p.t / total : 0, transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${(a * p.f).toFixed(1)}deg) scaleX(${p.f})` };
  });
  const anim = el.animate(frames, { duration: total * 1000, easing: 'linear', fill: 'both' });
  if (initial) anim.currentTime = total * 1000 * R(0.15, 0.55);
  anim.onfinish = () => el.remove();
}

function loop() {
  clearTimeout(timer);
  if (!document.hidden) spawn();
  timer = setTimeout(loop, R(2500, 7000));
}

export function startFish() {
  if (timer) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // первое заполнение — как только появится меню
  const first = () => {
    if (!seaBox()) { timer = setTimeout(first, 800); return; }
    spawn(true); setTimeout(() => spawn(true), 400);
    timer = setTimeout(loop, R(2500, 6000));
  };
  first();
}
