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
  last = now;
  ft += 0.016;
  sC += (sT - sC) * 0.045;

  bgMat.uniforms.time.value    = ft;
  bgMat.uniforms.scroll.value  = sC;
  pMat.uniforms.time.value     = ft;
  nebMat.uniforms.time.value   = ft;
  nebMat.uniforms.scroll.value = sC;

  const pa = pGeo.attributes.position.array;
  for (let i = 0; i < CNT; i++) {
    pa[i*3]   += pVX[i];
    pa[i*3+1] += pVY[i];
    if (pa[i*3+1] >  8) pa[i*3+1] = -8;
    if (pa[i*3]   > 10) pa[i*3]   = -10;
    if (pa[i*3]   <-10) pa[i*3]   =  10;
  }
  pGeo.attributes.position.needsUpdate = true;

  crescents.forEach(c => {
    c.rotation.x += c.userData.rx;
    c.rotation.y += c.userData.ry;
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

// ── IntersectionObserver reveal ───────────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
document.querySelectorAll('[class*="reveal"], .section-label').forEach(el => io.observe(el));

// ── Glass cards ───────────────────────────────────────────────────────────────
document.querySelectorAll(
  '.person-card,.event-card,.family-card,.host-card,.rel-block,.invite-text,.invite-venue-text,.dua-meaning'
).forEach(el => el.classList.add('glass'));
