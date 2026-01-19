// sketch-hero.js
// LoadingScreen - lightweight, self-contained canvas loading screens
// Usage:
//   const loader = new LoadingScreen({ style: 0 });
//   loader.show();
//   loader.setProgress(0.5); // optional for progress-style
//   loader.hide();

class LoadingScreen {
  constructor({
    style = 0,           // 0 = rotating dots, 1 = progress bar, 2 = pulse rings
    background = 'rgba(12, 14, 20, 0.95)',
    color = '#7bd389',
    size = 'cover',      // 'cover' = full screen, or {w:,..,h:..}
    text = 'Loading',
    fadeDuration = 300
  } = {}) {
    this.style = style;
    this.background = background;
    this.color = color;
    this.size = size;
    this.text = text;
    this.fadeDuration = fadeDuration;
    this.progress = 0; // 0..1 for progress bar style
    this.visible = false;
    this._running = false;

    this._createDOM();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }

  _createDOM() {
    // overlay container
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      left: 0, top: 0,
      width: '100vw', height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: this.background,
      zIndex: 9999,
      opacity: '0',
      transition: `opacity ${this.fadeDuration}ms ease`
    });

    // canvas
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      display: 'block'
    });
    this.ctx = this.canvas.getContext('2d');

    // text
    this.textEl = document.createElement('div');
    Object.assign(this.textEl.style, {
      position: 'absolute',
      bottom: '8%',
      left: '50%',
      transform: 'translateX(-50%)',
      color: this.color,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      fontSize: '16px',
      letterSpacing: '0.6px',
      opacity: '0.95',
      userSelect: 'none'
    });
    this.textEl.innerText = this.text;

    this.container.appendChild(this.canvas);
    this.container.appendChild(this.textEl);
    document.body.appendChild(this.container);
  }

  _onResize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  setStyle(i) {
    this.style = i | 0;
  }

  setProgress(p) {
    this.progress = Math.max(0, Math.min(1, p));
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';
    this._start();
  }

  hide() {
    if (!this.visible) return;
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
    setTimeout(() => {
      this.visible = false;
      this._stop();
    }, this.fadeDuration);
  }

  _start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._time = 0;
    this._frame();
  }

  _stop() {
    this._running = false;
  }

  _frame() {
    if (!this._running) return;
    const now = performance.now();
    const dt = (now - this._last) / 1000;
    this._last = now;
    this._time += dt;
    this._draw(this._time, dt);
    requestAnimationFrame(() => this._frame());
  }

  _clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  // easing
  _ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _draw(t) {
    this._clear();
    switch (this.style) {
      case 0: this._drawRotatingDots(t); break;
      case 1: this._drawProgressBar(t); break;
      case 2: this._drawPulseRings(t); break;
      default: this._drawRotatingDots(t);
    }
  }

  _drawRotatingDots(t) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const baseSize = Math.min(this.width, this.height) * 0.12;
    const radius = baseSize * 0.6;
    const dotCount = 7;
    const rotation = t * 1.6; // rad/s

    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2 + rotation;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const phase = (Math.sin(t * 4 + i) + 1) / 2;
      const r = 6 + phase * 10;
      ctx.beginPath();
      ctx.fillStyle = this._mixColor(this.color, '#ffffff', 0.12 + (i / dotCount) * 0.18);
      ctx.globalAlpha = 0.8 + 0.2 * phase;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // center subtle rotating ring
    ctx.beginPath();
    ctx.strokeStyle = this._mixColor(this.color, '#000000', 0.35);
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, radius * 0.38, rotation, rotation + Math.PI * 1.4);
    ctx.stroke();
  }

  _drawProgressBar(t) {
    const ctx = this.ctx;
    const w = Math.min(720, this.width * 0.8);
    const h = 18;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const x = cx - w / 2;
    const y = cy - h / 2;

    // background bar
    ctx.beginPath();
    this._roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();

    // animated progress (use eased progress for smoothing)
    const prog = this.progress;
    const eased = this._ease(prog);
    const fillW = w * eased;

    // fill gradient
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, this._mixColor(this.color, '#fff', 0.2));
    g.addColorStop(1, this.color);
    ctx.beginPath();
    this._roundRect(ctx, x, y, fillW, h, h / 2);
    ctx.fillStyle = g;
    ctx.fill();

    // particles along the front
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const phase = (i / particleCount + t * 0.4) % 1;
      const px = x + fillW - (1 - phase) * 34;
      const py = cy + Math.sin((phase + i * 0.1) * Math.PI * 2) * 6;
      const alpha = Math.max(0, 1 - Math.abs(px - (x + fillW)) / 40);
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.6 * alpha;
      ctx.arc(px, py, 3 + phase * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // percentage text
    ctx.font = '600 14px Inter, system-ui';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(prog * 100) + '%', cx, y - 16);
  }

  _drawPulseRings(t) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxR = Math.min(this.width, this.height) * 0.25;

    // layered rings
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.7 + i * 0.6) % 1;
      const r = maxR * (0.3 + phase * 0.9);
      const alpha = (1 - phase) * 0.25;
      ctx.beginPath();
      ctx.strokeStyle = this._mixColor(this.color, '#ffffff', 0.06 + i * 0.04);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2 + i;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // central pulsating orb
    const pulse = (Math.sin(t * 3) + 1) / 2;
    ctx.beginPath();
    const orbR = 12 + pulse * 18;
    const g = ctx.createRadialGradient(cx, cy, orbR * 0.1, cx, cy, orbR * 1.6);
    g.addColorStop(0, this._mixColor(this.color, '#fff', 0.3));
    g.addColorStop(1, this._mixColor(this.color, '#000', 0.6));
    ctx.fillStyle = g;
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fill();

    // tiny orbiting sparks
    for (let i = 0; i < 10; i++) {
      const a = t * (0.9 + i * 0.05) + i * 0.63;
      const rr = maxR * (0.55 + Math.sin(t * 1.5 + i) * 0.08);
      const sx = cx + Math.cos(a) * rr;
      const sy = cy + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.fillStyle = this._mixColor(this.color, '#fff', 0.1 + (i % 2) * 0.1);
      ctx.globalAlpha = 0.9 - (i / 12);
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // mix hex color with white or black (t from 0..1)
  _mixColor(hex, otherHex, t) {
    const c1 = this._hexToRgb(hex);
    const c2 = this._hexToRgb(otherHex);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r},${g},${b})`;
  }

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }
}

/* Example usage (uncomment to try):
const loader = new LoadingScreen({ style: 1, color: '#58a6ff', text: 'Loading project...' });
loader.show();

// simulate progress
let p = 0;
const id = setInterval(() => {
  p += Math.random() * 0.08;
  loader.setProgress(Math.min(1, p));
  if (p >= 1) {
    clearInterval(id);
    setTimeout(() => loader.hide(), 500);
  }
}, 300);

// switch style after 3s
setTimeout(() => loader.setStyle(2), 3000);
*/

export default LoadingScreen;