/**
 * app.js — Orquestrador Principal da Visualização de Exoplanetas
 * 
 * Gerencia três fases da experiência:
 * 1. Intro Canvas (galáxia, sistema solar, métodos de captura)
 * 2. Scrollytelling D3.js (3 atos narrativos)
 * 3. Dashboard Sandbox (scatterplot, ficha, gráficos)
 * 
 * Implementa o sistema de estado global com pub/sub para coordenação.
 */

import { METHODS_CONFIG, planetsDataset, allPlanetsRaw, computedStats, TOTAL_DISCOVERIES, YEAR_RANGE } from './data.js';
import { hasCalculatedValues, getMethodColor, getTypeColor, formatNumber } from './utils.js';
import { PlanetCard } from './planet-card.js';
import { SizeBarChart, TimelineChart, MethodBarChart } from './charts.js';
import { StarMap } from './star-map.js';
import { Scatterplot } from './scatterplot.js';
import { ParallelCoords } from './parallel-coords.js';
import { NetworkGraph } from './network-graph.js';

// ============================================
// ESTADO GLOBAL + PUB/SUB
// ============================================

const state = {
    selectedPlanet: null,
    selectedMethod: 'all',
    selectedYear: 'all',
    selectedDistance: 'all',
    selectedType: 'all',
    searchQuery: '',
    currentPage: 1,
    phase: 'canvas' // 'canvas' | 'dashboard'
};

const listeners = new Set();
function subscribe(fn) { listeners.add(fn); }
function dispatch() { listeners.forEach(fn => fn(state)); }

// ============================================
// REFERÊNCIAS GLOBAIS
// ============================================

let planetCard = null;
let starMap = null;
let sizeBarChart = null;
let scatterPlot = null;
let timelineChart = null;
let networkGraph = null;
let methodBarChart = null;
let parallelCoords = null;

// ============================================
// FASE 1 — INTRO CANVAS (Preservada da v1)
// ============================================

const GW = document.getElementById('gw');
const GC = document.getElementById('galaxy');
const SC = document.getElementById('stars');
const GX = GC.getContext('2d');
const SX = SC.getContext('2d');
let W = window.innerWidth;
let H = window.innerHeight;
let CX = W / 2;
let CY = H / 2;

let targetCX = W / 2;
let targetCY = H / 2 - 160;
let currentCX = W / 2;
let currentCY = H / 2 - 160;

let targetProgress = 0.0;
let scrollProgress = 0.0;

GC.width = W; GC.height = H;
SC.width = W; SC.height = H;

window.addEventListener('resize', () => {
    W = window.innerWidth;
    H = window.innerHeight;
    CX = W / 2;
    CY = H / 2;
    if (curProgress === 0) { targetCX = W / 2; targetCY = H / 2 - 160; }
    else { targetCX = W / 2; targetCY = H / 2; }
    GC.width = W; GC.height = H;
    SC.width = W; SC.height = H;
    initStars();
});

let targetZoom = 1.0;
let currentZoom = 1.0;
let targetSolarOpacity = 0.0;
let currentSolarOpacity = 0.0;
let targetGalaxyOpacity = 1.0;
let currentGalaxyOpacity = 1.0;

let targetFocusMode = 0.0;
let currentFocusMode = 0.0;
let galaxyCX = W / 2;
let galaxyCY = H / 2;
let solarCX = W / 2;
let solarCY = H / 2;

let transitionSpeedZoom = 0.018;
let transitionSpeedOpacity = 0.018;
let transitionSpeedPos = 0.018;

let orbitMode = 'aesthetic';
let orbitModeTransition = 0.0;
let hoveredPlanetIdx = -1;
let selectedPlanetIdx = -1;

const SOLAR_SYSTEM_PLANETS = [
    { name: 'Mercúrio', aestheticR: 35, realR: 19, size: 1.5, realSize: 1.0, color: '#94A3B8', speed: 0.04 },
    { name: 'Vênus', aestheticR: 50, realR: 22, size: 2.5, realSize: 2.0, color: '#EAB308', speed: 0.015 },
    { name: 'Terra', aestheticR: 65, realR: 24, size: 2.7, realSize: 2.2, color: '#3B82F6', speed: 0.01 },
    { name: 'Marte', aestheticR: 80, realR: 29, size: 2.0, realSize: 1.5, color: '#EF4444', speed: 0.008 },
    { name: 'Júpiter', aestheticR: 110, realR: 62, size: 6.0, realSize: 8.5, color: '#F97316', speed: 0.002 },
    { name: 'Saturno', aestheticR: 140, realR: 101, size: 5.0, realSize: 7.2, color: '#FCD34D', speed: 0.0009, rings: true },
    { name: 'Urano', aestheticR: 175, realR: 188, size: 3.8, realSize: 4.5, color: '#22D3EE', speed: 0.0004 },
    { name: 'Netuno', aestheticR: 205, realR: 285, size: 3.6, realSize: 4.2, color: '#6366F1', speed: 0.0002 }
];

const SOLAR_PLANETS_DATA = [
    { name: 'Mercúrio', dia: '4.879 km', dist: '0,39 UA', period: '88 dias', temp: '167 °C', desc: 'O menor planeta do Sistema Solar e o mais próximo do Sol.' },
    { name: 'Vênus', dia: '12.104 km', dist: '0,72 UA', period: '225 dias', temp: '464 °C', desc: 'Semelhante em tamanho à Terra, mas com uma atmosfera densa e tóxica.' },
    { name: 'Terra', dia: '12.742 km', dist: '1,00 UA', period: '365 dias', temp: '15 °C', desc: 'Nosso lar. O único mundo conhecido a abrigar vida.' },
    { name: 'Marte', dia: '6.779 km', dist: '1,52 UA', period: '687 dias', temp: '-62 °C', desc: 'O Planeta Vermelho. Possui uma atmosfera tênue e calotas polares de gelo.' },
    { name: 'Júpiter', dia: '139.820 km', dist: '5,20 UA', period: '12 anos', temp: '-108 °C', desc: 'O gigante gasoso supremo do Sistema Solar.' },
    { name: 'Saturno', dia: '116.460 km', dist: '9,58 UA', period: '29 anos', temp: '-139 °C', desc: 'Famoso por seu espetacular sistema de anéis.' },
    { name: 'Urano', dia: '50.724 km', dist: '19,22 UA', period: '84 anos', temp: '-197 °C', desc: 'Um gigante gelado que orbita o Sol deitado de lado.' },
    { name: 'Netuno', dia: '49.244 km', dist: '30,06 UA', period: '165 anos', temp: '-201 °C', desc: 'O planeta mais distante, açoitado pelos ventos mais rápidos.' }
];

// Métodos da intro (5 métodos nos 3 atos)
const METHODS = [
    { name: 'Pulsar Timing', ...METHODS_CONFIG['Pulsar Timing'] },
    { name: 'Velocidade Radial', ...METHODS_CONFIG['Velocidade Radial'] },
    { name: 'Trânsito', ...METHODS_CONFIG['Trânsito'] },
    { name: 'Imagem Direta', ...METHODS_CONFIG['Imagem Direta'] },
    { name: 'Micro-lente', ...METHODS_CONFIG['Micro-lente'] }
];

const PLANETS = planetsDataset;

let starPts = [];
let methodPts = [];
let cur = 0, locked = false, mIdx = -1;
let t = 0;
let rafId = null;

let curProgress = 0;
const MAX_PROGRESS = 4;

// -- Stars --
function initStars() {
    starPts = [];
    for (let i = 0; i < 320; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        starPts.push({ x, y, ox: x, oy: y, r: Math.random() * .9 + .3, a: Math.random() * .6 + .1, twink: Math.random() * Math.PI * 2 });
    }
}

function drawStars(time) {
    SX.clearRect(0, 0, W, H);
    let warpFactor = 0.0;
    if (scrollProgress > 1.0 && scrollProgress < 2.0) {
        warpFactor = Math.max(0.0, 1.0 - Math.abs(scrollProgress - 1.5) / 0.5);
    }
    starPts.forEach(s => {
        const a = s.a + Math.sin(time * .0008 + s.twink) * .15;
        const dx = s.ox - currentCX;
        const dy = s.oy - currentCY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const displacement = warpFactor * 160 * (dist / W);
        const x = s.ox + ux * displacement;
        const y = s.oy + uy * displacement;
        if (warpFactor > 0.05) {
            SX.beginPath(); SX.moveTo(s.ox + ux * displacement * 0.5, s.oy + uy * displacement * 0.5); SX.lineTo(x, y);
            SX.strokeStyle = `rgba(255,255,255,${a * warpFactor})`; SX.lineWidth = s.r * (1 + warpFactor * 1.5); SX.stroke();
        } else {
            SX.beginPath(); SX.arc(x, y, s.r, 0, Math.PI * 2); SX.fillStyle = `rgba(255,255,255,${a})`; SX.fill();
        }
    });
}

function drawGalaxyCore(time) {
    const cx = galaxyCX, cy = galaxyCY;
    const grd = GX.createRadialGradient(cx, cy, 0, cx, cy, 110 * currentZoom);
    grd.addColorStop(0, 'rgba(255,220,160,.55)'); grd.addColorStop(.3, 'rgba(180,140,255,.2)');
    grd.addColorStop(.7, 'rgba(80,100,200,.08)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    GX.beginPath(); GX.arc(cx, cy, 110 * currentZoom, 0, Math.PI * 2); GX.fillStyle = grd; GX.fill();
    GX.beginPath(); GX.arc(cx, cy, 8.5 * currentZoom, 0, Math.PI * 2); GX.fillStyle = 'rgba(255,230,180,.95)'; GX.fill();
    GX.beginPath(); GX.arc(cx, cy, 14.5 * currentZoom, 0, Math.PI * 2); GX.fillStyle = 'rgba(255,200,120,.3)'; GX.fill();

    let armAlphaMult = 0.0;
    if (scrollProgress >= 1.0) armAlphaMult = Math.min(1.0, scrollProgress - 1.0);
    if (armAlphaMult > 0.01) {
        const NUM_ARMS = 3, PPA = 220;
        for (let a = 0; a < NUM_ARMS; a++) {
            const baseAngle = (a / NUM_ARMS) * Math.PI * 2;
            for (let i = 0; i < PPA; i++) {
                const frac = i / PPA;
                const r = (22 + frac * 306) * currentZoom;
                const spin = frac * 4.2 + baseAngle - time * .00012;
                const spread = (frac * 22 + 5) * (Math.random() - .5) * currentZoom;
                const px = cx + Math.cos(spin) * r + (Math.random() - .5) * spread;
                const py = cy + Math.sin(spin) * r * .45 + (Math.random() - .5) * spread * .45;
                const alpha = ((1 - frac) * .18 + .04) * armAlphaMult;
                const sz = (.5 + frac * .8) * (1 - frac * .5) * Math.max(0.5, currentZoom);
                const hue = 200 + frac * 40;
                GX.beginPath(); GX.arc(px, py, sz, 0, Math.PI * 2); GX.fillStyle = `hsla(${hue},70%,75%,${alpha})`; GX.fill();
            }
        }
    }
}

function drawSolarSystem(time, opacity) {
    const cx = solarCX, cy = solarCY;
    let recoilFactor = 1.0;
    if (scrollProgress > 1.0 && scrollProgress < 2.0) recoilFactor = 1.0 - (scrollProgress - 1.0);
    else if (scrollProgress >= 2.0) recoilFactor = 0.0;

    const sunRadius = 14 * currentZoom * (0.3 + 0.7 * recoilFactor);
    const sunGrd = GX.createRadialGradient(cx, cy, 0, cx, cy, sunRadius * 2.5);
    sunGrd.addColorStop(0, 'rgba(255,230,150,1)'); sunGrd.addColorStop(0.2, `rgba(255,180,50,${0.8 * opacity * recoilFactor})`);
    sunGrd.addColorStop(0.6, `rgba(255,100,0,${0.2 * opacity * recoilFactor})`); sunGrd.addColorStop(1, 'rgba(255,100,0,0)');
    GX.beginPath(); GX.arc(cx, cy, sunRadius * 2.5, 0, Math.PI * 2); GX.fillStyle = sunGrd; GX.fill();

    SOLAR_SYSTEM_PLANETS.forEach((p, idx) => {
        const targetR = p.aestheticR + (p.realR - p.aestheticR) * orbitModeTransition;
        const orbitR = targetR * currentZoom * recoilFactor;
        const isHighlighted = (idx === hoveredPlanetIdx || idx === selectedPlanetIdx);

        GX.beginPath(); GX.ellipse(cx, cy, orbitR, orbitR * 0.45, 0, 0, Math.PI * 2);
        if (isHighlighted) { GX.strokeStyle = p.color; GX.lineWidth = 1.6; GX.globalAlpha = 0.5 * opacity * recoilFactor; }
        else { GX.strokeStyle = `rgba(255,255,255,${0.07 * opacity * recoilFactor})`; GX.lineWidth = 0.8; GX.globalAlpha = 1.0; }
        if (recoilFactor > 0.01) GX.stroke();
        GX.globalAlpha = 1.0;

        const angle = time * p.speed * 0.04 + idx * 1.5;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR * 0.45;
        const basePlanetSize = p.size + (p.realSize - p.size) * orbitModeTransition;
        const planetSize = Math.max(1.0, basePlanetSize * currentZoom) * recoilFactor;

        if (planetSize > 0.1) {
            if (p.rings) {
                GX.beginPath(); GX.ellipse(px, py, planetSize * 1.8, planetSize * 0.8, 0.2, 0, Math.PI * 2);
                GX.strokeStyle = `rgba(252,211,77,${(isHighlighted ? 0.9 : 0.6) * opacity * recoilFactor})`; GX.lineWidth = (isHighlighted ? 2.2 : 1.5) * currentZoom; GX.stroke();
            }
            GX.beginPath(); GX.arc(px, py, planetSize, 0, Math.PI * 2); GX.fillStyle = p.color; GX.globalAlpha = opacity * recoilFactor; GX.fill(); GX.globalAlpha = 1.0;
        }

        if (isHighlighted && opacity > 0.3 && recoilFactor > 0.1) {
            GX.beginPath(); GX.arc(px, py, planetSize + 6 * currentZoom, 0, Math.PI * 2);
            GX.strokeStyle = `rgba(255,255,255,${0.45 * opacity * recoilFactor})`; GX.lineWidth = 1.0; GX.stroke();
        }

        if (opacity > 0.2 && (currentZoom > 0.7 || isHighlighted)) {
            GX.fillStyle = isHighlighted ? '#fff' : `rgba(255,255,255,${0.45 * opacity * recoilFactor})`;
            GX.font = isHighlighted ? `bold ${Math.max(9, 11 * currentZoom)}px 'Inter'` : `${Math.max(8, 9 * currentZoom)}px 'Inter'`;
            GX.textAlign = 'center';
            if (recoilFactor > 0.1) GX.fillText(p.name, px, py - planetSize - (isHighlighted ? 8 : 4));
        }
    });
}

function drawMethodDots(time) {
    const cx = galaxyCX, cy = galaxyCY;
    methodPts.forEach(p => {
        const age = (time - p.born) * .001;
        if (age < 0) return;
        const prog = Math.min(1, age / 1.2);
        const ease = 1 - Math.pow(1 - prog, 3);
        const spinOffset = -time * p.spinSpeed * .0001;
        const curA = p.baseAngle + spinOffset;
        const r = p.r * currentZoom;
        const px = cx + Math.cos(curA) * r;
        const py = cy + Math.sin(curA) * r * .45;

        let methodFade = 0.0;
        const startFadeProgress = (p.methodIdx <= 1) ? 1.0 : (p.methodIdx === 2 ? 2.0 : 3.0);
        const slideProgress = scrollProgress - startFadeProgress;
        if (slideProgress >= 1.0) methodFade = 1.0;
        else if (slideProgress > 0.0) methodFade = slideProgress;
        if (methodFade <= 0.01) return;

        if (ease < 1) {
            GX.beginPath(); GX.arc(cx, cy, 3 * currentZoom, 0, Math.PI * 2); GX.fillStyle = p.color;
            GX.globalAlpha = .15 * (1 - ease) * methodFade * currentGalaxyOpacity; GX.fill(); GX.globalAlpha = 1;
            const trailX = cx + (px - cx) * ease, trailY = cy + (py - cy) * ease;
            GX.beginPath(); GX.moveTo(cx, cy); GX.lineTo(trailX, trailY); GX.strokeStyle = p.color;
            GX.globalAlpha = .06 * ease * methodFade * currentGalaxyOpacity; GX.lineWidth = .5; GX.stroke(); GX.globalAlpha = 1;
        }
        const fx = cx + (px - cx) * ease, fy = cy + (py - cy) * ease;
        GX.globalAlpha = ease * methodFade * currentGalaxyOpacity;
        GX.beginPath(); GX.arc(fx, fy, p.size * Math.max(0.6, currentZoom), 0, Math.PI * 2); GX.fillStyle = p.color; GX.fill(); GX.globalAlpha = 1;
    });
}

function spawnPointsForProgress(progress) {
    const now = t;
    if (progress < 2) {
        methodPts = [];
        return;
    }

    let maxMethodIdx = -1;
    if (progress === 2) maxMethodIdx = 1; // Pulsar (0) & RV (1)
    else if (progress === 3) maxMethodIdx = 2; // Pulsar (0), RV (1), Transit (2)
    else if (progress === 4) maxMethodIdx = 4; // All: Pulsar (0), RV (1), Transit (2), Imaging (3), Microlens (4)

    methodPts = methodPts.filter(p => p.methodIdx <= maxMethodIdx);

    for (let i = 0; i <= maxMethodIdx; i++) {
        if (methodPts.some(p => p.methodIdx === i)) continue;
        const m = METHODS[i];
        if (!m) continue;
        const z = m.zone || { minR: 48, maxR: 120 };

        let count = 0;
        if (i === 0) count = 15;        // Pulsar Timing
        else if (i === 1) count = 55;   // Velocidade Radial
        else if (i === 2) count = 140;  // Trânsito
        else if (i === 3) count = 35;   // Imagem Direta
        else if (i === 4) count = 60;   // Micro-lente

        for (let j = 0; j < count; j++) {
            const r = z.minR + Math.random() * (z.maxR - z.minR);
            methodPts.push({
                methodIdx: i,
                baseAngle: Math.random() * Math.PI * 2,
                r: r + (Math.random() - .5) * 22,
                size: 1.2 + Math.random() * 2.8,
                color: m.color || '#94A3B8',
                spinSpeed: .8 + Math.random() * .8,
                born: now - (count - j) * 8
            });
        }
    }
}

// -- Navigation --
const STORIES = ['sb0', 'sb1', 'sb2', 'sb3', 'sb4'];

function showStory(idx, prevProgress) {
    STORIES.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
            if (i === idx) {
                el.style.opacity = '1';
                el.classList.add('active');
            } else {
                el.style.opacity = '0';
                el.classList.remove('active');
            }
        }
    });

    const scalePanel = document.getElementById('solar-scale-panel');
    if (scalePanel) {
        if (idx === 1) {
            scalePanel.classList.add('on');
        } else {
            scalePanel.classList.remove('on');
            hoveredPlanetIdx = -1;
            selectedPlanetIdx = -1;
            resetScalePop();
        }
    }

    const applyTargets = () => {
        if (idx === 0) {
            targetZoom = 1.5;
            targetSolarOpacity = 0.0;
            targetGalaxyOpacity = 1.0;
            targetCX = W / 2;
            targetCY = H / 2 - 160;
            targetFocusMode = 0.0;
            transitionSpeedZoom = transitionSpeedOpacity = transitionSpeedPos = 0.018;
        }
        else if (idx === 1) {
            targetZoom = 3.2;
            targetSolarOpacity = 1.0;
            targetGalaxyOpacity = 0.0;
            targetCX = W / 2;
            targetCY = H / 2;
            targetFocusMode = 1.0;
            transitionSpeedZoom = transitionSpeedOpacity = transitionSpeedPos = 0.015;
        }
        else if (idx >= 2) {
            targetZoom = 1.25;
            targetSolarOpacity = 0.0;
            targetGalaxyOpacity = 1.0;
            targetCX = W / 2;
            targetCY = H / 2;
            targetFocusMode = 0.0;
            if (prevProgress === 1) {
                transitionSpeedZoom = transitionSpeedOpacity = transitionSpeedPos = 0.006;
            } else {
                transitionSpeedZoom = transitionSpeedOpacity = transitionSpeedPos = 0.018;
            }
        }
    };

    if (window.transitionTimeout) clearTimeout(window.transitionTimeout);
    applyTargets();

    const yrMap = ['—', '~1950', '1992', '2009', 'Hoje'];
    const yr = document.getElementById('yr');
    if (yr) {
        const yrText = yrMap[idx] || '';
        yr.textContent = yrText;
        yr.className = 'yr-badge' + (yrText && yrText !== '—' ? ' on' : '');
    }

    const progEl = document.getElementById('prog');
    if (progEl) {
        progEl.style.width = ((idx / MAX_PROGRESS) * 100) + '%';
    }

    document.querySelectorAll('.nd').forEach((d, i) => {
        d.classList.toggle('on', i === idx);
    });

    const legendEl = document.getElementById('legend');
    if (legendEl) {
        legendEl.classList.toggle('on', idx >= 2);
    }

    spawnPointsForProgress(idx);

    const hintEl = document.getElementById('hint');
    if (hintEl) {
        hintEl.classList.toggle('hide', idx === 4);
    }
}

function goToProgress(nextProgress) {
    if (locked || nextProgress === curProgress || nextProgress < 0 || nextProgress > MAX_PROGRESS) return;
    locked = true;
    const prevProgress = curProgress;
    curProgress = nextProgress;
    targetProgress = nextProgress;
    let lockTime = 600;
    showStory(curProgress, prevProgress);
    setTimeout(() => { locked = false; }, lockTime);
}

let cTimer = null;
function startCounter() {
    if (cTimer) clearInterval(cTimer);
    let v = 0;
    const el = document.getElementById('cnum');
    el.textContent = '+0';
    cTimer = setInterval(() => {
        v = Math.min(v + 82, TOTAL_DISCOVERIES);
        el.textContent = '+' + v.toLocaleString('pt-BR');
        if (v >= TOTAL_DISCOVERIES) clearInterval(cTimer);
    }, 18);
}

// -- Input handlers --
function handleActionInput(dir) {
    const nextProgress = curProgress + dir;
    if (nextProgress > MAX_PROGRESS && dir > 0) {
        enterDash();
    } else {
        goToProgress(nextProgress);
    }
}

let scrollBuf = 0, scrollTimer = null;
GW.addEventListener('wheel', e => {
    e.preventDefault();
    if (locked) { scrollBuf = 0; return; }
    scrollBuf += e.deltaY;
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
        if (Math.abs(scrollBuf) >= 50) handleActionInput(scrollBuf > 0 ? 1 : -1);
        scrollBuf = 0; scrollTimer = null;
    }, 50);
}, { passive: false });

window.addEventListener('keydown', e => {
    if (state.phase !== 'canvas') return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') handleActionInput(1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') handleActionInput(-1);
});

let touchStartY = 0;
GW.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
GW.addEventListener('touchend', e => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 40) handleActionInput(diff > 0 ? 1 : -1);
}, { passive: true });

function mkNavDots() {
    const nd = document.getElementById('navd');
    if (!nd) return;
    nd.innerHTML = '';
    for (let i = 0; i <= MAX_PROGRESS; i++) {
        const d = document.createElement('div');
        d.className = 'nd' + (i === 0 ? ' on' : '');
        d.onclick = () => goToProgress(i);
        nd.appendChild(d);
    }
}

// -- Scale Panel helpers --
function resetScalePop() {
    const t = document.getElementById('pop-title'), d = document.getElementById('pop-desc'), g = document.getElementById('pop-grid');
    if (t && d && g) { t.textContent = 'Nosso Lar'; d.textContent = 'O Sistema Solar consiste em uma estrela central (o Sol) e oito planetas principais orbitando ao seu redor. Passe o mouse ou clique em um planeta para explorar sua escala e dados físicos.'; g.style.display = 'none'; }
    document.querySelectorAll('.lineup-item').forEach(item => item.classList.remove('active'));
}

function updateScalePop(idx) {
    const data = SOLAR_PLANETS_DATA[idx]; if (!data) return;
    const t = document.getElementById('pop-title'), d = document.getElementById('pop-desc'), g = document.getElementById('pop-grid');
    if (t && d && g) {
        t.textContent = data.name; d.textContent = data.desc; g.style.display = 'grid';
        document.getElementById('pop-dia').textContent = data.dia; document.getElementById('pop-dist').textContent = data.dist;
        document.getElementById('pop-period').textContent = data.period; document.getElementById('pop-temp').textContent = data.temp;
    }
    document.querySelectorAll('.lineup-item').forEach((item, i) => { const active = (hoveredPlanetIdx !== -1) ? hoveredPlanetIdx : selectedPlanetIdx; item.classList.toggle('active', i === active); });
}

// -- Animation Loop --
function loop(time) {
    if (state.phase !== 'canvas') { rafId = requestAnimationFrame(loop); return; }
    t = time;
    scrollProgress += (targetProgress - scrollProgress) * 0.025;
    currentZoom += (targetZoom - currentZoom) * transitionSpeedZoom;
    currentSolarOpacity += (targetSolarOpacity - currentSolarOpacity) * transitionSpeedOpacity;
    currentGalaxyOpacity += (targetGalaxyOpacity - currentGalaxyOpacity) * transitionSpeedOpacity;
    currentCX += (targetCX - currentCX) * transitionSpeedPos;
    currentCY += (targetCY - currentCY) * transitionSpeedPos;
    let targetOrbit = (orbitMode === 'real') ? 1.0 : 0.0;
    orbitModeTransition += (targetOrbit - orbitModeTransition) * 0.05;

    currentFocusMode += (targetFocusMode - currentFocusMode) * transitionSpeedZoom;

    // Coordenadas galáxia / sistema solar (Solar System está em um dos braços espirais da Via Láctea)
    // A rotação acompanha os braços espirais da galáxia (-time * 0.00012)
    const theta = 0.8 - time * 0.00012;
    const baseDist = 135; // Distância do sistema solar ao centro galáctico
    const shiftX = Math.cos(theta) * baseDist * currentZoom;
    const shiftY = Math.sin(theta) * baseDist * 0.45 * currentZoom;

    galaxyCX = currentCX - currentFocusMode * shiftX;
    galaxyCY = currentCY - currentFocusMode * shiftY;
    solarCX = galaxyCX + shiftX;
    solarCY = galaxyCY + shiftY;

    drawStars(time);
    GX.clearRect(0, 0, W, H);

    if (currentGalaxyOpacity > 0.01) { GX.globalAlpha = currentGalaxyOpacity; drawGalaxyCore(time); GX.globalAlpha = 1.0; }
    if (currentSolarOpacity > 0.01) drawSolarSystem(time, currentSolarOpacity);
    drawMethodDots(time);

    rafId = requestAnimationFrame(loop);
}

// ============================================
// FASE 2 — TRANSIÇÕES ENTRE FASES
// ============================================

window.enterDash = function () {
    state.phase = 'dashboard';
    GW.style.display = 'none';

    const dashEl = document.getElementById('dashboard');
    dashEl.classList.remove('dash-hidden');
    dashEl.classList.add('dash-visible');
    document.body.style.overflow = 'hidden';

    // Inicializar dashboard (lazy — só na primeira vez)
    if (!starMap) {
        initDashboard();
    }
};

window.exitDash = function () {
    state.phase = 'canvas';
    const dashEl = document.getElementById('dashboard');
    dashEl.classList.remove('dash-visible');
    dashEl.classList.add('dash-hidden');

    GW.style.display = '';
    document.body.style.overflow = 'hidden';

    curProgress = 4;
    showStory(4, 4);
};

window.setOrbitMode = function (mode) {
    orbitMode = mode;
    document.getElementById('btn-scale-aesthetic').classList.toggle('active', mode === 'aesthetic');
    document.getElementById('btn-scale-real').classList.toggle('active', mode === 'real');
};
window.hoverPlanet = function (idx) { hoveredPlanetIdx = idx; updateScalePop(idx); };
window.unhoverPlanet = function () { hoveredPlanetIdx = -1; if (selectedPlanetIdx !== -1) updateScalePop(selectedPlanetIdx); else resetScalePop(); };
window.selectScalePlanet = function (idx) { if (selectedPlanetIdx === idx) { selectedPlanetIdx = -1; resetScalePop(); } else { selectedPlanetIdx = idx; updateScalePop(idx); } };

window.selectPlanet = function (planet) {
    state.selectedPlanet = planet;
    if (planet) {
        planetCard.show(planet);
    } else {
        planetCard.hide();
    }
    
    // Sincronizar destaque nos outros gráficos
    if (starMap) starMap.highlight(planet);
    if (scatterPlot) scatterPlot.select(planet);
    if (parallelCoords) parallelCoords.highlight(planet);
    if (sizeBarChart) sizeBarChart.selectType(planet ? planet.type : 'all');
    if (methodBarChart) methodBarChart.selectMethod(planet ? planet.methodPT : 'all');
    if (timelineChart) timelineChart.selectMethod(planet ? planet.methodPT : 'all');

    updateResetButton();
    dispatch();
};

window.deselectPlanet = function () {
    state.selectedPlanet = null;
    if (planetCard) planetCard.hide();
    
    if (starMap) starMap.highlight(null);
    if (scatterPlot) scatterPlot.select(null);
    if (parallelCoords) parallelCoords.highlight(null);
    if (sizeBarChart) sizeBarChart.selectType('all');
    if (methodBarChart) methodBarChart.selectMethod('all');
    if (timelineChart) timelineChart.selectMethod('all');
    
    updateResetButton();
    dispatch();
};

window.resetFilters = function () {
    state.selectedMethod = 'all';
    state.selectedType = 'all';
    state.selectedYear = 'all';
    state.selectedDistance = 'all';
    state.searchQuery = '';
    state.currentPage = 1;
    state.selectedPlanet = null;

    document.getElementById('filter-method').value = 'all';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-year').value = 'all';
    document.getElementById('filter-dist').value = 'all';

    if (planetCard) planetCard.hide();
    if (starMap) starMap.resetZoom();

    applyFilters();
};

// ============================================
// FASE 3 — DASHBOARD (Figma)
// ============================================

function initDashboard() {
    // Preencher filtros
    populateFilters();

    // Instanciar ficha lateral
    planetCard = new PlanetCard();

    // Instanciar gráficos com pequeno delay
    setTimeout(() => {
        // 0. Mapa Estelar
        starMap = new StarMap('star-map-container', allPlanetsRaw, {
            onSelect: (planet) => {
                selectPlanet(planet);
            }
        });

        // 1. Tipo de Planeta Bar Chart
        sizeBarChart = new SizeBarChart('size-chart', allPlanetsRaw);

        // 2. Scatterplot de Massa x Raio
        scatterPlot = new Scatterplot('scatter-container', allPlanetsRaw, {
            onSelect: (planet) => {
                selectPlanet(planet);
            }
        });

        // 3. Timeline de Descobertas
        timelineChart = new TimelineChart('timeline-chart', allPlanetsRaw);

        // 4. Rede de Relações
        networkGraph = new NetworkGraph('network-graph', allPlanetsRaw);

        // 5. Quantidade por Método
        methodBarChart = new MethodBarChart('method-bar-chart', allPlanetsRaw);

        // 6. Coordenadas Paralelas
        parallelCoords = new ParallelCoords('parallel-coords', allPlanetsRaw, {
            onBrush: (brushes) => {
                // Brushing do coordenadas paralelas pode opcionalmente filtrar localmente,
                // mas para evitar sobrecarga de estado síncrona, apenas destacamos as linhas.
            }
        });

        applyFilters();
    }, 100);

    // Bind filtros dropdown
    document.getElementById('filter-method').addEventListener('change', (e) => {
        state.selectedMethod = e.target.value;
        state.currentPage = 1;
        applyFilters();
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
        state.selectedType = e.target.value;
        state.currentPage = 1;
        applyFilters();
    });

    document.getElementById('filter-year').addEventListener('change', (e) => {
        state.selectedYear = e.target.value;
        state.currentPage = 1;
        applyFilters();
    });

    document.getElementById('filter-dist').addEventListener('change', (e) => {
        state.selectedDistance = e.target.value;
        state.currentPage = 1;
        applyFilters();
    });

    // Iniciar botão de reset desabilitado
    updateResetButton();
}

function populateFilters() {
    const methodSelect = document.getElementById('filter-method');
    const typeSelect = document.getElementById('filter-type');

    // Métodos
    const methods = [...new Set(allPlanetsRaw.map(d => d.methodPT))].sort();
    methods.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        methodSelect.appendChild(opt);
    });

    // Tipos
    const types = [...new Set(allPlanetsRaw.map(d => d.type))].filter(t => t !== 'Desconhecido').sort();
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });
}

// Handler de busca textual
window.handleTableSearch = function () {
    const searchVal = document.getElementById('table-search').value;
    state.searchQuery = searchVal;
    state.currentPage = 1;
    applyFilters();
};

// Handler de mudança de página
window.changeTablePage = function (dir) {
    state.currentPage += dir;
    applyFilters();
};

window.goToTablePage = function (page) {
    state.currentPage = page;
    applyFilters();
};

function updateKPIs(data) {
    const uniqueStars = new Set(data.map(d => d.star)).size;
    const earthLike = data.filter(d => d.type === 'Terrestre').length;
    const uniqueMethods = new Set(data.map(d => d.methodPT)).size;

    const elPlanets = document.getElementById('kpi-planets');
    const elSystems = document.getElementById('kpi-systems');
    const elEarthlike = document.getElementById('kpi-earthlike');
    const elMethods = document.getElementById('kpi-methods');

    if (elPlanets) elPlanets.textContent = data.length.toLocaleString('pt-BR');
    if (elSystems) elSystems.textContent = uniqueStars.toLocaleString('pt-BR');
    if (elEarthlike) elEarthlike.textContent = earthLike.toLocaleString('pt-BR');
    if (elMethods) elMethods.textContent = uniqueMethods.toLocaleString('pt-BR');
}

function updateResetButton() {
    const isFiltering = 
        state.selectedMethod !== 'all' ||
        state.selectedType !== 'all' ||
        state.selectedYear !== 'all' ||
        state.selectedDistance !== 'all' ||
        state.selectedPlanet !== null;

    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
        resetBtn.disabled = !isFiltering;
        resetBtn.classList.toggle('disabled', !isFiltering);
    }
}

function applyFilters() {
    let filtered = allPlanetsRaw;

    // 1. Filtro de método
    if (state.selectedMethod !== 'all') {
        filtered = filtered.filter(d => d.methodPT === state.selectedMethod);
    }

    // 2. Filtro de tipo
    if (state.selectedType !== 'all') {
        filtered = filtered.filter(d => d.type === state.selectedType);
    }

    // 3. Filtro de ano
    if (state.selectedYear !== 'all') {
        const [minY, maxY] = state.selectedYear.split('-').map(Number);
        filtered = filtered.filter(d => d.year >= minY && d.year <= maxY);
    }

    // 4. Filtro de distância
    if (state.selectedDistance !== 'all') {
        const [minD, maxD] = state.selectedDistance.split('-').map(Number);
        filtered = filtered.filter(d => d.distLY !== null && d.distLY >= minD && d.distLY <= maxD);
    }

    // 5. Filtro de busca textual
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(d => d.name.toLowerCase().includes(q) || d.star.toLowerCase().includes(q));
    }

    // Atualizar KPIs
    updateKPIs(filtered);

    // Atualizar gráficos do dashboard
    if (starMap) starMap.updateData(filtered);
    if (sizeBarChart) {
        sizeBarChart.updateData(filtered);
        sizeBarChart.selectType(state.selectedPlanet ? state.selectedPlanet.type : state.selectedType);
    }
    if (scatterPlot) scatterPlot.updateData(filtered);
    if (timelineChart) {
        timelineChart.updateData(filtered);
        timelineChart.selectMethod(state.selectedPlanet ? state.selectedPlanet.methodPT : state.selectedMethod);
    }
    if (methodBarChart) {
        methodBarChart.updateData(filtered);
        methodBarChart.selectMethod(state.selectedPlanet ? state.selectedPlanet.methodPT : state.selectedMethod);
    }

    updateResetButton();
}

// ============================================
// INICIALIZAÇÃO
// ============================================

initStars();
mkNavDots();
goToProgress(0);
requestAnimationFrame(loop);
