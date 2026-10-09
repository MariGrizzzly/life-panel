// Фейерверк из брызг — когда поднимаешь вес
const COLORS = ['#6BC0F5', '#A6DBFA', '#2E8FD6', '#FFFFFF', '#38D0E0', '#1666A8'];
const R = (a, b) => a + Math.random() * (b - a);

export function splash(x, y, text = '') {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (text) pill(x, y, text);
  if (reduce) return;
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:300';
  document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);

  const drops = [];
  // три залпа: из кнопки и два чуть выше и в стороны
  const bursts = [[x, y, 0], [x - R(60, 110), y - R(70, 130), 260], [x + R(60, 110), y - R(70, 130), 420]];
  bursts.forEach(([bx, by, delay]) => {
    const n = delay ? 46 : 70;
    for (let i = 0; i < n; i++) {
      const a = delay ? R(0, Math.PI * 2) : R(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = delay ? R(2.5, 7.5) : R(5, 13);
      drops.push({ x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: R(1.6, 4.6), col: COLORS[i % COLORS.length], t: -delay / 16.7, life: R(55, 95) });
    }
  });
  const rings = bursts.map(([bx, by, delay]) => ({ x: bx, y: by, t: -delay / 16.7 }));

  let frame = 0;
  const tick = () => {
    frame++;
    g.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    rings.forEach((r) => {
      r.t++; if (r.t < 0 || r.t > 40) return; alive++;
      const k = r.t / 40;
      g.beginPath(); g.ellipse(r.x, r.y, 10 + k * 90, (10 + k * 90) * 0.42, 0, 0, Math.PI * 2);
      g.strokeStyle = `rgba(107,192,245,${(1 - k) * 0.7})`; g.lineWidth = 3 * (1 - k) + 0.5; g.stroke();
    });
    drops.forEach((d) => {
      d.t++; if (d.t < 0 || d.t > d.life) return; alive++;
      d.vy += 0.28; d.vx *= 0.985; d.x += d.vx; d.y += d.vy;
      const k = d.t / d.life;
      const sp = Math.hypot(d.vx, d.vy);
      g.save(); g.translate(d.x, d.y); g.rotate(Math.atan2(d.vy, d.vx));
      g.globalAlpha = Math.min(1, (1 - k) * 1.4);
      g.beginPath(); g.ellipse(0, 0, d.r * (1 + Math.min(sp, 12) * 0.12), d.r, 0, 0, Math.PI * 2);
      g.fillStyle = d.col; g.fill();
      g.beginPath(); g.arc(d.r * 0.3, -d.r * 0.35, d.r * 0.35, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
      g.restore();
    });
    if (alive && frame < 260) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

function pill(x, y, text) {
  const p = document.createElement('div');
  p.className = 'fx-pill';
  p.textContent = text;
  document.body.appendChild(p);
  const w = p.offsetWidth;
  const left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2));
  p.style.left = left + 'px'; p.style.top = Math.max(12, y - 70) + 'px';
  p.animate([
    { opacity: 0, transform: 'translateY(16px) scale(.8)' },
    { opacity: 1, transform: 'translateY(0) scale(1.06)', offset: 0.15 },
    { opacity: 1, transform: 'translateY(-10px) scale(1)', offset: 0.75 },
    { opacity: 0, transform: 'translateY(-30px) scale(.96)' }
  ], { duration: 2200, easing: 'ease-out', fill: 'both' }).onfinish = () => p.remove();
}
