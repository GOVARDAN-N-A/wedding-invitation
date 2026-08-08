// ── Three.js ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('bg');
const isMobile = window.innerWidth < 768;

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 5;

// ── Background shader — 8 colour moods + dual noise + vignette + gold veins ──
const bgMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, scroll: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
  `,
  fragmentShader: `
    uniform float time;
    uniform float scroll;
    varying vec2 vUv;

    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){
      vec2 i=floor(p), f=fract(p);
      f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);
    }

    vec3 pal(float t){
      vec3 c[8];
      c[0]=vec3(.07,.00,.14); c[1]=vec3(.14,.02,.07);
      c[2]=vec3(.11,.06,.01); c[3]=vec3(.04,.02,.14);
      c[4]=vec3(.10,.00,.09); c[5]=vec3(.02,.07,.12);
      c[6]=vec3(.09,.04,.01); c[7]=vec3(.12,.00,.10);
      float x=t*7.; int i=int(x); float f=fract(x);
      f=f*f*(3.-2.*f);
      return i>=7 ? c[7] : mix(c[i],c[i+1],f);
    }

    void main(){
      vec3 base = pal(scroll);
      float n1 = n(vUv*2.5 + time*0.07);
      float n2 = n(vUv*5.0 - time*0.04 + 3.7);
      float nm  = n1*0.65 + n2*0.35;
      float vg  = clamp(1.0 - dot(vUv-0.5, vUv-0.5)*2.0, 0., 1.);
      float vein = smoothstep(0.47, 0.50, nm) * 0.06;
      vec3 gold  = vec3(0.78, 0.65, 0.40);
      float spot  = clamp(1.0 - length(vUv-0.5)*1.2, 0., 1.) * 0.18;
      vec3 col = base*(0.5+nm*0.85)*vg + gold*vein + base*spot;
      gl_FragColor = vec4(clamp(col,0.,1.), 1.);
    }
  `
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 20), bgMat));

// ── Nebula glow plane — adds purple/gold depth behind everything ──────────────
const nebMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, scroll: { value: 0 } },
  transparent: true,
  depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform float time; uniform float scroll; varying vec2 vUv;
    void main(){
      vec2 uv = vUv - 0.5;
      float r1 = clamp(1.0 - length(uv*vec2(1.4,1.0))*2.0, 0., 1.);
      float r2 = clamp(1.0 - length((uv-vec2(.3,.2))*vec2(.8,1.2))*2.2, 0., 1.);
      float g  = r1*0.14 + r2*0.09;
      vec3 tint = mix(vec3(0.5,0.2,0.65), vec3(0.75,0.50,0.18), scroll);
      float pulse = 0.7 + 0.3*sin(time*0.35);
      gl_FragColor = vec4(tint * g, g * 0.75 * pulse);
    }
  `
});
const nebMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), nebMat);
nebMesh.position.z = -2.5;
scene.add(nebMesh);

// ── Gold particles ─────────────────────────────────────────────────────────────
const CNT = isMobile ? 150 : 230;
const pPos = new Float32Array(CNT * 3);
const pSz  = new Float32Array(CNT);
const pVX  = new Float32Array(CNT);
const pVY  = new Float32Array(CNT);
for (let i = 0; i < CNT; i++) {
  pPos[i*3]   = (Math.random()-.5)*18;
  pPos[i*3+1] = (Math.random()-.5)*14;
  pPos[i*3+2] = (Math.random()-.5)*6;
  pSz[i]      = Math.random()*5 + 0.8;
  pVX[i]      = (Math.random()-.5)*0.0022;
  pVY[i]      = Math.random()*0.005 + 0.001;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('size',     new THREE.BufferAttribute(pSz, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: `
    attribute float size; uniform float time; varying float vA;
    void main(){
      vA = 0.2 + 0.75*abs(sin(time*1.6 + position.x*1.4 + position.y*0.8));
      vec4 mv = modelViewMatrix*vec4(position,1.);
      gl_PointSize = size*(170./-mv.z);
      gl_Position  = projectionMatrix*mv;
    }`,
  fragmentShader: `
    varying float vA;
    void main(){
      float d = distance(gl_PointCoord, vec2(0.5));
      if(d > 0.5) discard;
      gl_FragColor = vec4(0.84, 0.70, 0.43, pow(1.-d*2.,1.6)*vA);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
scene.add(new THREE.Points(pGeo, pMat));

// ── Crescent arcs — 3 rings, low-poly, GPU rotation only ─────────────────────
const crescents = [];
for (let i = 0; i < 3; i++) {
  const geo = new THREE.TorusGeometry(0.5 + i*0.45, 0.025, 6, 24, Math.PI*(1.2 + i*0.15));
  const mat = new THREE.MeshBasicMaterial({ color: 0xc8a96e, transparent: true, opacity: 0.07 + i*0.035 });
  const m   = new THREE.Mesh(geo, mat);
  m.position.set((Math.random()-.5)*6, (Math.random()-.5)*5, -2.5 - i*0.8);
  m.userData = { rx:(Math.random()-.5)*0.003, ry:(Math.random()-.5)*0.004, ph: i*2.1 };
  scene.add(m);
  crescents.push(m);
}



// ── Render loop ───────────────────────────────────────────────────────────────
let ft=0, sT=0, sC=0, last=0;
const CAP = isMobile ? 34 : 16;

function loop(now) {
  requestAnimationFrame(loop);
  if (now - last < CAP) return;
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  ft += dt;
  sC += (sT - sC) * Math.min(1, dt * 2.7);
  const step = dt * 60; // normalise per-frame speeds to 60fps

  bgMat.uniforms.time.value    = ft;
  bgMat.uniforms.scroll.value  = sC;
  pMat.uniforms.time.value     = ft;
  nebMat.uniforms.time.value   = ft;
  nebMat.uniforms.scroll.value = sC;

  const pa = pGeo.attributes.position.array;
  for (let i = 0; i < CNT; i++) {
    pa[i*3]   += pVX[i] * step;
    pa[i*3+1] += pVY[i] * step;
    if (pa[i*3+1] >  8) pa[i*3+1] = -8;
    if (pa[i*3]   > 10) pa[i*3]   = -10;
    if (pa[i*3]   <-10) pa[i*3]   =  10;
  }
  pGeo.attributes.position.needsUpdate = true;

  crescents.forEach(c => {
    c.rotation.x += c.userData.rx * step;
    c.rotation.y += c.userData.ry * step;
    c.rotation.z  = ft * 0.12 + c.userData.ph;
  });



  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, { passive: true });

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  sT = max > 0 ? window.scrollY / max : 0;
}, { passive: true });


// ── Floating petals ───────────────────────────────────────────────────────────
const pc   = document.getElementById('particles');
const syms = ['🌹','🌸','✦','🌺','☪','✿','🌙','❀','⋆','✧'];
const N    = isMobile ? 12 : 20;
for (let i = 0; i < N; i++) {
  const el  = document.createElement('div');
  el.className  = 'petal';
  el.textContent = syms[i % syms.length];
  const dur  = 10 + Math.random() * 16;
  el.style.cssText = `left:${Math.random()*100}vw;font-size:${0.65+Math.random()*1.1}rem;animation-duration:${dur}s;animation-delay:${-(Math.random()*dur)}s;--drift:${(Math.random()-.5)*110}px`;
  pc.appendChild(el);
}

// ── IntersectionObserver reveal + particle burst ─────────────────────────────
function spawnBurst(count) {
  const pc2 = document.getElementById('particles');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute;
      left:${35 + Math.random()*30}vw;
      top:${40 + Math.random()*20}vh;
      font-size:${0.5 + Math.random()*0.8}rem;
      opacity:0;
      pointer-events:none;
      animation: burstPop ${0.6 + Math.random()*0.8}s ease-out forwards;
      animation-delay:${Math.random()*0.3}s;
      --bx:${(Math.random()-0.5)*120}px;
      --by:${-40 - Math.random()*80}px;
    `;
    el.textContent = ['✦','✧','🌸','❀','☽','✿'][Math.floor(Math.random()*6)];
    pc2.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const inHero = e.target.closest('.s-hero');
      if (inHero && !inHero.classList.contains('entrance-active')) return;
      e.target.classList.add('visible');
      if (e.target.classList.contains('section-label')) spawnBurst(8);
    } else {
      const inHero = e.target.closest('.s-hero');
      const inScratch = e.target.closest('.scratch-card-container');
      if (!inHero && !inScratch) {
        e.target.classList.remove('visible');
      }
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
document.querySelectorAll('[class*="reveal"], .section-label').forEach(el => io.observe(el));

function revealHeroContent() {
  const hero = document.getElementById('s-hero');
  if (!hero) return;
  hero.querySelectorAll('[class*="reveal"], .section-label').forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('visible');
      if (el.classList.contains('section-label')) spawnBurst(8);
    }, 150 + i * 80);
  });
}

// ── Section entrance animations (doors / bloom / confetti) ───────────────────
const CONFETTI_COLORS = ['#c8a96e', '#e8b8c8', '#fdf8e0', '#f0d060', '#d4af70', '#e08080', '#ff80ab', '#ffd54f'];
const confettiTriggered = new Set();

// ── Physics-based canvas celebration ─────────────────────────────────────────
let celebCanvas = null;
let celebCtx = null;
let celebParticles = [];
let celebRAF = null;

function initCelebCanvas() {
  if (celebCanvas) return;
  celebCanvas = document.createElement('canvas');
  celebCanvas.style.cssText = `
    position: fixed; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 9999;
  `;
  document.body.appendChild(celebCanvas);
  celebCtx = celebCanvas.getContext('2d');
  celebCanvas.width = window.innerWidth;
  celebCanvas.height = window.innerHeight;
  window.addEventListener('resize', () => {
    celebCanvas.width = window.innerWidth;
    celebCanvas.height = window.innerHeight;
  });
}

function launchCelebration(originX, originY) {
  initCelebCanvas();
  celebParticles = [];

  // Firework rockets that burst at top
  const ROCKETS = 7;
  for (let r = 0; r < ROCKETS; r++) {
    const delay = r * 120;
    setTimeout(() => {
      const tx = originX + (Math.random() - 0.5) * window.innerWidth * 0.7;
      const ty = window.innerHeight * (0.05 + Math.random() * 0.25);
      launchRocket(originX, originY, tx, ty);
    }, delay);
  }

  // Gold confetti ribbons
  for (let i = 0; i < 80; i++) {
    celebParticles.push({
      type: 'confetti',
      x: originX + (Math.random() - 0.5) * 60,
      y: originY,
      vx: (Math.random() - 0.5) * 8,
      vy: -(4 + Math.random() * 8),
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.3,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      alpha: 1,
      gravity: 0.18 + Math.random() * 0.12,
      drag: 0.985,
      life: 1,
      lifeDecay: 0.004 + Math.random() * 0.003,
      delay: Math.random() * 600
    });
  }

  if (!celebRAF) celebLoop();
}

function launchRocket(sx, sy, tx, ty) {
  const speed = 14 + Math.random() * 6;
  const angle = Math.atan2(ty - sy, tx - sx);
  const trail = { type: 'rocket', x: sx, y: sy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, tx, ty, alpha: 1 };
  trail.onBurst = () => burstFirework(trail.x, trail.y);
  celebParticles.push(trail);
}

function burstFirework(cx, cy) {
  const count = 55 + Math.floor(Math.random() * 30);
  const hue = Math.random() * 60 + 30; // gold–amber–rose range
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 2 + Math.random() * 5;
    celebParticles.push({
      type: 'spark',
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      lifeDecay: 0.016 + Math.random() * 0.012,
      size: 1.5 + Math.random() * 2.5,
      color: `hsl(${hue + (Math.random() - 0.5) * 30}, 95%, ${55 + Math.random() * 30}%)`,
      gravity: 0.06,
      drag: 0.97,
      trail: [],
      alpha: 1
    });
  }
  // Gold glitter ring
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const speed = 1.2 + Math.random() * 1.5;
    celebParticles.push({
      type: 'glitter',
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, lifeDecay: 0.022,
      size: 3 + Math.random() * 3,
      color: '#f5e090',
      gravity: 0.04, drag: 0.96, alpha: 1
    });
  }
}

function celebLoop() {
  celebCtx.clearRect(0, 0, celebCanvas.width, celebCanvas.height);
  const now = performance.now();

  celebParticles = celebParticles.filter(p => {
    if (p.delay && now < p.delay) return true; // wait for delay
    if (p.type === 'rocket') {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 18) { p.onBurst(); return false; }
      // Draw rocket tail
      celebCtx.beginPath();
      celebCtx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      celebCtx.fillStyle = `rgba(245, 224, 144, ${p.alpha})`;
      celebCtx.fill();
      // Exhaust trail
      for (let t = 0; t < 3; t++) {
        celebCtx.beginPath();
        celebCtx.arc(p.x - p.vx * t * 0.5, p.y - p.vy * t * 0.5, 1.5 - t * 0.4, 0, Math.PI * 2);
        celebCtx.fillStyle = `rgba(200,169,110,${0.4 - t * 0.12})`;
        celebCtx.fill();
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // slight gravity on rocket
      return true;
    }
    if (p.type === 'spark') {
      // Draw spark with short trailing line
      celebCtx.beginPath();
      celebCtx.moveTo(p.x, p.y);
      celebCtx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      celebCtx.strokeStyle = p.color.replace(')', `, ${p.life * 0.8})`).replace('hsl', 'hsla');
      celebCtx.lineWidth = p.size * 0.8;
      celebCtx.lineCap = 'round';
      celebCtx.stroke();
      // dot at head
      celebCtx.beginPath();
      celebCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      celebCtx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('hsl', 'hsla');
      celebCtx.fill();
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.life -= p.lifeDecay;
      return p.life > 0;
    }
    if (p.type === 'glitter') {
      celebCtx.save();
      celebCtx.translate(p.x, p.y);
      celebCtx.globalAlpha = p.life;
      celebCtx.fillStyle = p.color;
      celebCtx.beginPath();
      // Draw ✦ shape
      const s = p.size;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        celebCtx.moveTo(0, 0);
        celebCtx.lineTo(Math.cos(a) * s * 2, Math.sin(a) * s * 2);
        celebCtx.lineTo(Math.cos(a + 0.2) * s * 0.5, Math.sin(a + 0.2) * s * 0.5);
      }
      celebCtx.fill();
      celebCtx.restore();
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.life -= p.lifeDecay;
      return p.life > 0;
    }
    if (p.type === 'confetti') {
      if (p.delay > now) return true;
      celebCtx.save();
      celebCtx.translate(p.x, p.y);
      celebCtx.rotate(p.rot);
      celebCtx.globalAlpha = p.life;
      celebCtx.fillStyle = p.color;
      celebCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      celebCtx.restore();
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.gravity;
      p.vx += Math.sin(now * 0.003 + p.rot) * 0.12; // gentle sway
      p.x += p.vx; p.y += p.vy;
      p.rot += p.rotV;
      p.life -= p.lifeDecay;
      return p.life > 0 && p.y < window.innerHeight + 50;
    }
    return false;
  });

  if (celebParticles.length > 0) {
    celebRAF = requestAnimationFrame(celebLoop);
  } else {
    celebRAF = null;
    celebCtx.clearRect(0, 0, celebCanvas.width, celebCanvas.height);
  }
}

function spawnBurst(count) { /* kept for compatibility – noop now */ }
function spawnConfetti(stage, count) { /* kept for compatibility – noop now */ }

function triggerEntrance(section) {
  if (section.id === 's-hero') return;
  const type = section.dataset.entrance;
  if (!type) return;

  section.classList.add('entrance-active');

  if (type === 'doors' || type === 'float') {
    revealHeroContent();
    if (type === 'doors') setTimeout(() => section.classList.add('entrance-done'), 3200);
  }

  if (type === 'confetti') {
    const stage = section.querySelector('.confetti-stage');
    if (stage && !confettiTriggered.has(section.id)) {
      confettiTriggered.add(section.id);
      const bursts = isMobile ? 1 : 2;
      const perBurst = isMobile ? 26 : 42;
      for (let b = 0; b < bursts; b++) {
        setTimeout(() => spawnConfetti(stage, perBurst), b * 350);
      }
    }
  }
}

const entranceIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      triggerEntrance(e.target);
    } else {
      if (e.target.id !== 's-hero') {
        e.target.classList.remove('entrance-active');
        confettiTriggered.delete(e.target.id);
      }
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -4% 0px' });

document.querySelectorAll('[data-entrance]').forEach(section => {
  entranceIO.observe(section);
});

// Set entrance-active immediately for hero and reveal content right away
const heroImmediate = document.getElementById('s-hero');
if (heroImmediate) {
  heroImmediate.classList.add('entrance-active');
  requestAnimationFrame(() => setTimeout(revealHeroContent, 300));
}

// ── Pointer parallax tilt for 3D scenes (desktop only) ───────────────────────
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const tiltTargets = document.querySelectorAll('.scene-3d');
  let tiltQueued = false;
  window.addEventListener('pointermove', (e) => {
    if (tiltQueued) return;
    tiltQueued = true;
    const px = e.clientX, py = e.clientY;
    requestAnimationFrame(() => {
      tiltQueued = false;
      const rx = ((py / window.innerHeight) - 0.5) * -8;
      const ry = ((px / window.innerWidth) - 0.5) * 10;
      tiltTargets.forEach(el => {
        el.style.setProperty('--tiltX', rx.toFixed(2) + 'deg');
        el.style.setProperty('--tiltY', ry.toFixed(2) + 'deg');
      });
    });
  }, { passive: true });
}

// ── Glass cards ───────────────────────────────────────────────────────────────
document.querySelectorAll(
  '.person-card,.event-card,.family-card,.host-card,.rel-block,.invite-text,.invite-venue-text,.dua-meaning'
).forEach(el => el.classList.add('glass'));

// ── Interactive Scratch Card for Bride & Groom ────────────────────────────────
function initScratchCard() {
  const container = document.querySelector('.scratch-card-container');
  const canvas = document.getElementById('scratch-canvas');
  const autoBtn = document.getElementById('btn-auto-reveal');
  const resetBtn = document.getElementById('btn-reset-scratch');
  if (!canvas || !container) return;

  const ctx = canvas.getContext('2d');
  let isScratching = false;
  let scratchedPercent = 0;
  let isCleared = false;

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const width = rect.width || container.offsetWidth || 340;
    const height = rect.height || container.offsetHeight || 280;
    canvas.width = width;
    canvas.height = height;
    drawFoil();
  }

  function drawFoil() {
    if (isCleared) return;
    ctx.globalCompositeOperation = 'source-over';
    
    // Royal Deep Maroon & Gold Foil Gradient Background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#420a1c');
    grad.addColorStop(0.3, '#2a0410');
    grad.addColorStop(0.7, '#380816');
    grad.addColorStop(1, '#1f020a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Gold Lattice Lines
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
    ctx.lineWidth = 1.2;
    for (let i = -canvas.height; i < canvas.width + canvas.height; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + canvas.height, canvas.height);
      ctx.stroke();
    }
    for (let i = canvas.width + canvas.height; i > -canvas.height; i -= 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - canvas.height, canvas.height);
      ctx.stroke();
    }

    // Outer Royal Gold Border Frame
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    ctx.strokeStyle = 'rgba(255, 225, 140, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    // Corner Ornaments
    ctx.fillStyle = '#f5e090';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❖', 22, 22);
    ctx.fillText('❖', canvas.width - 22, 22);
    ctx.fillText('❖', 22, canvas.height - 22);
    ctx.fillText('❖', canvas.width - 22, canvas.height - 22);

    // Center Royal Gold Wax Seal / Badge
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const badgeR = Math.min(80, canvas.width * 0.24);

    ctx.beginPath();
    ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
    const badgeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, badgeR);
    badgeGrad.addColorStop(0, '#2a0410');
    badgeGrad.addColorStop(0.75, '#190209');
    badgeGrad.addColorStop(1, '#4a0c20');
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.strokeStyle = '#f5e090';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner Beaded Ring
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, badgeR - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Center Badge Text - ONLY Scratch Here
    ctx.fillStyle = '#f5e090';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px "Catamaran", sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText('✨ Scratch Here ✨', cx, cy);
    ctx.shadowBlur = 0;
  }

  function scratch(x, y) {
    if (isCleared) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();

    // Spawn glitter particle at scratch point
    if (Math.random() < 0.35) {
      spawnGlitter(x, y);
    }

    checkScratchProgress();
  }

  function spawnGlitter(x, y) {
    const p = document.createElement('div');
    p.className = 'scratch-glitter';
    p.style.left = (x + (Math.random() - 0.5) * 16) + 'px';
    p.style.top = (y + (Math.random() - 0.5) * 16) + 'px';
    p.textContent = ['✦', '✨', '🌸', '✧'][Math.floor(Math.random() * 4)];
    container.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }

  function checkScratchProgress() {
    const sampleStep = 20;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparentCount = 0;
    let totalSamples = 0;

    for (let i = 3; i < pixels.length; i += 4 * sampleStep) {
      totalSamples++;
      if (pixels[i] < 128) {
        transparentCount++;
      }
    }

    scratchedPercent = transparentCount / totalSamples;
    // Auto-reveal at just 30% scratched
    if (scratchedPercent > 0.30 && !isCleared) {
      revealAll();
    }
  }

  function revealAll() {
    if (isCleared) return;
    isCleared = true;

    // Smooth canvas fade-out
    canvas.style.transition = 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
    canvas.style.opacity = '0';
    canvas.style.transform = 'scale(1.04)';
    setTimeout(() => { canvas.style.display = 'none'; }, 950);

    if (autoBtn) autoBtn.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'inline-block';

    // Get screen position of the scratch card centre
    const rect = container.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    // Launch the real physics celebration after canvas fades
    setTimeout(() => launchCelebration(originX, originY), 400);
  }

  function resetScratch() {
    isCleared = false;
    canvas.style.display = 'block';
    canvas.style.transition = 'none';
    canvas.style.transform = 'none';
    canvas.style.opacity = '1';
    resizeCanvas();
    if (autoBtn) autoBtn.style.display = 'inline-block';
    if (resetBtn) resetBtn.style.display = 'none';
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  canvas.addEventListener('mousedown', (e) => { isScratching = true; const p = getPos(e); scratch(p.x, p.y); });
  window.addEventListener('mousemove', (e) => { if (isScratching) { const p = getPos(e); scratch(p.x, p.y); } });
  window.addEventListener('mouseup', () => { isScratching = false; });

  canvas.addEventListener('touchstart', (e) => { isScratching = true; const p = getPos(e); scratch(p.x, p.y); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (isScratching) { const p = getPos(e); scratch(p.x, p.y); } }, { passive: true });
  canvas.addEventListener('touchend', () => { isScratching = false; });

  if (autoBtn) autoBtn.addEventListener('click', revealAll);
  if (resetBtn) resetBtn.addEventListener('click', resetScratch);

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 300);
}

document.addEventListener('DOMContentLoaded', initScratchCard);
window.addEventListener('load', initScratchCard);
setTimeout(initScratchCard, 300);
setTimeout(initScratchCard, 800);
