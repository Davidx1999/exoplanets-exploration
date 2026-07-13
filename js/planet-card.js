import { renderValue, getTypeColor, getMethodColor } from './utils.js';

/* ============================================================
   SVG ART GENERATOR (Desenho do Planeta na Ficha)
   ============================================================ */
function getSeededRandom(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  return function() {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

function drawPlanetInFicha(d) {
  const isSuperEarth = d.type === 'Super-Terra';
  const container = d3.select('#planet-drawing-container');
  container.selectAll('*').remove();

  const w = 240, h = 180;
  const cx = w / 2, cy = h / 2;
  const R = 46; // planet radius (reduced by 12px for 24px diameter decrease)

  const svgPlan = container.append('svg')
    .attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`)
    .style('overflow', 'visible');
  const defs = svgPlan.append('defs');


  const rand = getSeededRandom(d.name || 'exoplanet');
  const hex = d.hex || '#5B8DEF';
  const baseColor = d3.color(hex);
  const darkColor = baseColor ? baseColor.darker(2) : '#000';
  const lightColor = baseColor ? baseColor.brighter(1.2) : '#fff';

  // Pre-compute sub-type variant so gradient and detail blocks agree
  const seVariant = rand();  // used for Super-Earth
  const terSub = rand();     // used for Terrestrial

  const uid = (Math.random() * 1e8 | 0).toString(36);


  // ── ATMOSPHERE GLOW (outer) ──────────────────────────────────────────────
  const atmGrad = defs.append('radialGradient')
    .attr('id', `atm-${uid}`)
    .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
  atmGrad.append('stop').attr('offset', '62%').attr('stop-color', hex).attr('stop-opacity', 0);
  atmGrad.append('stop').attr('offset', '82%').attr('stop-color', hex).attr('stop-opacity', 0.18);
  atmGrad.append('stop').attr('offset', '100%').attr('stop-color', hex).attr('stop-opacity', 0);

  svgPlan.append('circle')
    .attr('cx', cx).attr('cy', cy)
    .attr('r', R + 20)
    .attr('fill', `url(#atm-${uid})`);

  // ── CLIP PATH ────────────────────────────────────────────────────────────
  defs.append('clipPath').attr('id', `clip-${uid}`)
    .append('circle').attr('cx', cx).attr('cy', cy).attr('r', R);

  // ── PLANET BODY GRADIENT ─────────────────────────────────────────────────
  const planetGrad = defs.append('radialGradient')
    .attr('id', `planet-${uid}`)
    .attr('cx', '38%').attr('cy', '32%').attr('r', '70%');

  if (d.category === 'gigantes') {
    // Gas giant: warm lit side, deep dark limb
    planetGrad.append('stop').attr('offset', '0%').attr('stop-color', lightColor).attr('stop-opacity', 0.9);
    planetGrad.append('stop').attr('offset', '20%').attr('stop-color', hex);
    planetGrad.append('stop').attr('offset', '68%').attr('stop-color', darkColor);
    planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
  } else if (d.category === 'netunos') {
    planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#cceeff');
    planetGrad.append('stop').attr('offset', '25%').attr('stop-color', hex);
    planetGrad.append('stop').attr('offset', '72%').attr('stop-color', darkColor);
    planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
  } else if (isSuperEarth) {
    // Super-Earth: massive iron/silicate world — dark metallic grey-brown crust
    if (seVariant < 0.33) {
      // Iron-rich metallic world
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#c8b89a');
      planetGrad.append('stop').attr('offset', '20%').attr('stop-color', '#7a6248');
      planetGrad.append('stop').attr('offset', '65%').attr('stop-color', '#3a2a1a');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    } else if (seVariant < 0.66) {
      // High-pressure water/rock hybrid (hycean-like)
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8eb8c8');
      planetGrad.append('stop').attr('offset', '22%').attr('stop-color', '#3c6878');
      planetGrad.append('stop').attr('offset', '68%').attr('stop-color', '#1a2e38');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    } else {
      // Volcanic super-earth with exposed mantle
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#e08050');
      planetGrad.append('stop').attr('offset', '18%').attr('stop-color', '#8c3010');
      planetGrad.append('stop').attr('offset', '68%').attr('stop-color', '#2a0a00');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    }
  } else {
    // Terrestrial (Earth-like)
    if (terSub < 0.25) {
      // Volcanic
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ff7700');
      planetGrad.append('stop').attr('offset', '18%').attr('stop-color', '#6b0000');
      planetGrad.append('stop').attr('offset', '75%').attr('stop-color', '#1a0000');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    } else if (terSub < 0.5) {
      // Ice world
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#eaf8ff');
      planetGrad.append('stop').attr('offset', '28%').attr('stop-color', '#8dd8f8');
      planetGrad.append('stop').attr('offset', '72%').attr('stop-color', '#1a567a');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    } else if (terSub < 0.75) {
      // Desert
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffe3b8');
      planetGrad.append('stop').attr('offset', '28%').attr('stop-color', '#c27c3e');
      planetGrad.append('stop').attr('offset', '72%').attr('stop-color', '#5c2d0e');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    } else {
      // Ocean / Habitable
      planetGrad.append('stop').attr('offset', '0%').attr('stop-color', '#c0e8ff');
      planetGrad.append('stop').attr('offset', '22%').attr('stop-color', '#1e88e5');
      planetGrad.append('stop').attr('offset', '70%').attr('stop-color', '#0d3b6e');
      planetGrad.append('stop').attr('offset', '100%').attr('stop-color', '#000');
    }
  }

  // ── RINGS (back pass) ────────────────────────────────────────────────────
  const hasRings = d.category === 'gigantes' && rand() > 0.25;
  const ringAngle = -15 + rand() * -20;
  const ringVariant = rand();

  if (hasRings) {
    const ringCount = ringVariant < 0.4 ? 2 : 3;
    const ringConfigs = [
      { rx: R * 1.55, ry: R * 0.31, sw: R * 0.155, opacity: 0.28, darken: 0 },
      { rx: R * 1.79, ry: R * 0.38, sw: R * 0.086, opacity: 0.18, darken: 0.3 },
      { rx: R * 1.98, ry: R * 0.45, sw: R * 0.052, opacity: 0.12, darken: 0.6 },
    ];

    for (let ri = 0; ri < ringCount; ri++) {
      const rc = ringConfigs[ri];
      // ring gradient fill
      const ringGradId = `ring-back-${ri}-${uid}`;
      const rg = defs.append('linearGradient')
        .attr('id', ringGradId)
        .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
      rg.append('stop').attr('offset', '0%').attr('stop-color', darkColor).attr('stop-opacity', rc.opacity * 0.4);
      rg.append('stop').attr('offset', '30%').attr('stop-color', hex).attr('stop-opacity', rc.opacity);
      rg.append('stop').attr('offset', '70%').attr('stop-color', hex).attr('stop-opacity', rc.opacity);
      rg.append('stop').attr('offset', '100%').attr('stop-color', darkColor).attr('stop-opacity', rc.opacity * 0.4);

      svgPlan.append('ellipse')
        .attr('cx', cx).attr('cy', cy)
        .attr('rx', rc.rx).attr('ry', rc.ry)
        .attr('fill', 'none')
        .attr('stroke', `url(#${ringGradId})`)
        .attr('stroke-width', rc.sw)
        .attr('transform', `rotate(${ringAngle}, ${cx}, ${cy})`);
    }
    // back-ring clip (hide ring behind planet)
    const backClip = defs.append('clipPath').attr('id', `ring-back-clip-${uid}`);
    backClip.append('rect').attr('x', 0).attr('y', cy).attr('width', w).attr('height', cy);
    // we use opacity on the back rings, no extra clip needed — planet sphere paints over them
  }

  // ── PLANET SPHERE ────────────────────────────────────────────────────────
  svgPlan.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', R)
    .attr('fill', `url(#planet-${uid})`);

  // ── SURFACE DETAILS (clipped to sphere) ──────────────────────────────────
  const detailGroup = svgPlan.append('g').attr('clip-path', `url(#clip-${uid})`);

  // Rotation animation
  const rotSpeed = 20 + rand() * 25;
  detailGroup.append('animateTransform')
    .attr('attributeName', 'transform').attr('type', 'rotate')
    .attr('from', `0 ${cx} ${cy}`).attr('to', `360 ${cx} ${cy}`)
    .attr('dur', `${rotSpeed}s`).attr('repeatCount', 'indefinite');

  if (d.category === 'gigantes') {
    // Horizontal atmospheric bands with subtle colour variance
    const numBands = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < numBands; i++) {
      const bandY = cy - R + (i / numBands) * (R * 2);
      const halfW = Math.sqrt(Math.max(0, R * R - Math.pow(bandY - cy, 2))) * 1.2;
      const isLight = rand() > 0.55;
      const bColor = isLight ? `rgba(255,255,255,${0.06 + rand() * 0.1})` : `rgba(0,0,0,${0.10 + rand() * 0.14})`;
      detailGroup.append('ellipse')
        .attr('cx', cx).attr('cy', bandY)
        .attr('rx', halfW + 5).attr('ry', (R * 1.5 / numBands) * (0.4 + rand() * 0.7))
        .attr('fill', bColor);
    }
    // Great storm oval
    if (rand() > 0.35) {
      const sy = cy + (rand() - 0.5) * R * 0.6;
      const sx = cx + (rand() - 0.5) * R * 0.4;
      const stormColor = rand() > 0.5 ? 'rgba(255,80,40,0.55)' : 'rgba(255,255,200,0.30)';
      detailGroup.append('ellipse')
        .attr('cx', sx).attr('cy', sy)
        .attr('rx', 13 + rand() * 9).attr('ry', 7 + rand() * 5)
        .attr('fill', stormColor);
      // storm inner bright core
      detailGroup.append('ellipse')
        .attr('cx', sx - 3).attr('cy', sy)
        .attr('rx', 5 + rand() * 4).attr('ry', 3 + rand() * 3)
        .attr('fill', 'rgba(255,255,255,0.22)');
    }
  } else if (d.category === 'netunos') {
    // Swirling cloud arcs and diagonal streaks
    for (let i = 0; i < 3; i++) {
      const bandY = cy - R * 0.6 + i * R * 0.6;
      detailGroup.append('ellipse')
        .attr('cx', cx).attr('cy', bandY)
        .attr('rx', R * 1.1).attr('ry', R * 0.22)
        .attr('fill', 'rgba(255,255,255,0.07)');
    }
    // Storm vortex
    if (rand() > 0.4) {
      const vx = cx + (rand() - 0.5) * R * 0.5;
      const vy = cy + (rand() - 0.5) * R * 0.5;
      detailGroup.append('circle').attr('cx', vx).attr('cy', vy).attr('r', 10 + rand() * 8)
        .attr('fill', 'rgba(255,255,255,0.16)');
      detailGroup.append('circle').attr('cx', vx - 2).attr('cy', vy).attr('r', 4 + rand() * 4)
        .attr('fill', 'rgba(255,255,255,0.35)');
    }
    // Diagonal streaks
    for (let i = 0; i < 4; i++) {
      const sx = cx + (rand() - 0.5) * R * 1.4;
      const sy = cy + (rand() - 0.5) * R * 1.4;
      detailGroup.append('line')
        .attr('x1', sx - 20).attr('y1', sy - 10)
        .attr('x2', sx + 20).attr('y2', sy + 10)
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 5)
        .attr('stroke-linecap', 'round');
    }
  } else if (isSuperEarth) {
    // ── SUPER-EARTH: massive rocky/metallic world ─────────────────────────
    if (seVariant < 0.33) {
      // Iron-rich world: deep angular tectonic plates, metallic sheen
      for (let i = 0; i < 8; i++) {
        const px = cx + (rand() - 0.5) * R * 1.8;
        const py = cy + (rand() - 0.5) * R * 1.8;
        const pr = 12 + rand() * 26;
        detailGroup.append('ellipse').attr('cx', px).attr('cy', py)
          .attr('rx', pr).attr('ry', pr * (0.4 + rand() * 0.5))
          .attr('fill', '#5a4030').attr('opacity', 0.65)
          .attr('transform', `rotate(${rand() * 180}, ${px}, ${py})`);
      }
      // Tectonic fault lines
      for (let i = 0; i < 8; i++) {
        const lx1 = cx + (rand() - 0.5) * R * 1.6, ly1 = cy + (rand() - 0.5) * R * 1.6;
        const lx2 = lx1 + (rand() - 0.5) * 40, ly2 = ly1 + (rand() - 0.5) * 40;
        detailGroup.append('line')
          .attr('x1', lx1).attr('y1', ly1).attr('x2', lx2).attr('y2', ly2)
          .attr('stroke', '#8a6840').attr('stroke-width', 1 + rand() * 1.5)
          .attr('stroke-linecap', 'round').attr('opacity', 0.5);
      }
      // Metallic bright patches (iron ore)
      for (let i = 0; i < 5; i++) {
        const mx = cx + (rand() - 0.5) * R * 1.4;
        const my = cy + (rand() - 0.5) * R * 1.4;
        detailGroup.append('circle').attr('cx', mx).attr('cy', my)
          .attr('r', 4 + rand() * 8)
          .attr('fill', '#c8a878').attr('opacity', 0.35);
      }
    } else if (seVariant < 0.66) {
      // Hycean / water-rock hybrid: dark rock slabs, pressurised water oceans
      for (let i = 0; i < 6; i++) {
        const px = cx + (rand() - 0.5) * R * 1.7;
        const py = cy + (rand() - 0.5) * R * 1.7;
        const pr = 14 + rand() * 24;
        detailGroup.append('ellipse').attr('cx', px).attr('cy', py)
          .attr('rx', pr).attr('ry', pr * (0.3 + rand() * 0.5))
          .attr('fill', '#2a3a40').attr('opacity', 0.80)
          .attr('transform', `rotate(${rand() * 180}, ${px}, ${py})`);
        // rock edge highlight
        detailGroup.append('ellipse').attr('cx', px).attr('cy', py)
          .attr('rx', pr).attr('ry', pr * (0.3 + rand() * 0.5))
          .attr('fill', 'none').attr('stroke', '#6a9ab0').attr('stroke-width', 1)
          .attr('opacity', 0.3)
          .attr('transform', `rotate(${rand() * 180}, ${px}, ${py})`);
      }
      // Pressurised ocean glints
      for (let i = 0; i < 4; i++) {
        const wx = cx + (rand() - 0.5) * R * 1.5;
        const wy = cy + (rand() - 0.5) * R * 1.5;
        detailGroup.append('ellipse').attr('cx', wx).attr('cy', wy)
          .attr('rx', 10 + rand() * 18).attr('ry', 4 + rand() * 6)
          .attr('fill', '#4a8898').attr('opacity', 0.45)
          .attr('transform', `rotate(${rand() * 30 - 15}, ${wx}, ${wy})`);
      }
      // Thick haze band
      detailGroup.append('ellipse').attr('cx', cx).attr('cy', cy - R * 0.55)
        .attr('rx', R * 1.1).attr('ry', R * 0.18)
        .attr('fill', 'rgba(100,160,180,0.12)');
    } else {
      // Volcanic super-earth: massive dark plates, huge lava rifts, mantle upwellings
      for (let i = 0; i < 7; i++) {
        const px = cx + (rand() - 0.5) * R * 1.8;
        const py = cy + (rand() - 0.5) * R * 1.8;
        detailGroup.append('ellipse').attr('cx', px).attr('cy', py)
          .attr('rx', 12 + rand() * 28).attr('ry', 8 + rand() * 16)
          .attr('fill', '#1c0800').attr('opacity', 0.90)
          .attr('transform', `rotate(${rand() * 180}, ${px}, ${py})`);
      }
      // Wide lava rifts
      for (let i = 0; i < 6; i++) {
        const lx = cx + (rand() - 0.5) * R * 1.5;
        const ly = cy + (rand() - 0.5) * R * 1.5;
        const lw = 20 + rand() * 30;
        detailGroup.append('path')
          .attr('d', `M${lx - lw/2} ${ly} Q${lx} ${ly + (rand()-0.5)*16} ${lx + lw/2} ${ly}`)
          .attr('fill', 'none')
          .attr('stroke', rand() > 0.5 ? '#ff6600' : '#ff9900')
          .attr('stroke-width', 2 + rand() * 3)
          .attr('stroke-linecap', 'round').attr('opacity', 0.75);
      }
      // Mantle upwelling blobs
      for (let i = 0; i < 5; i++) {
        const vx = cx + (rand() - 0.5) * R * 1.3;
        const vy = cy + (rand() - 0.5) * R * 1.3;
        detailGroup.append('circle').attr('cx', vx).attr('cy', vy)
          .attr('r', 5 + rand() * 9).attr('fill', '#e05010').attr('opacity', 0.70);
        detailGroup.append('circle').attr('cx', vx).attr('cy', vy)
          .attr('r', 2 + rand() * 4).attr('fill', '#ffcc44').attr('opacity', 0.65);
      }
    }

    // All Super-Earths: thick hazy atmosphere band at equator
    detailGroup.append('ellipse')
      .attr('cx', cx).attr('cy', cy)
      .attr('rx', R * 1.05).attr('ry', R * 0.12)
      .attr('fill', `rgba(${isSuperEarth ? '120,100,80' : '255,255,255'},0.08)`);

  } else {
    if (terSub < 0.25) {
      // Volcanic — lava veins, dark plates, glowing cracks
      for (let i = 0; i < 7; i++) {
        const px = cx + (rand() - 0.5) * R * 1.6;
        const py = cy + (rand() - 0.5) * R * 1.6;
        detailGroup.append('circle').attr('cx', px).attr('cy', py)
          .attr('r', 10 + rand() * 20).attr('fill', '#1a0900').attr('opacity', 0.88);
      }
      for (let i = 0; i < 6; i++) {
        const px = cx + (rand() - 0.5) * R * 1.5;
        const py = cy + (rand() - 0.5) * R * 1.5;
        const gColor = rand() > 0.5 ? 'rgba(255,120,0,0.8)' : 'rgba(255,220,0,0.55)';
        detailGroup.append('ellipse')
          .attr('cx', px).attr('cy', py)
          .attr('rx', 5 + rand() * 18).attr('ry', 2 + rand() * 4)
          .attr('fill', gColor)
          .attr('transform', `rotate(${rand() * 180}, ${px}, ${py})`);
      }
      // Volcano vents
      for (let i = 0; i < 4; i++) {
        const vx = cx + (rand() - 0.5) * R * 1.2;
        const vy = cy + (rand() - 0.5) * R * 1.2;
        detailGroup.append('circle').attr('cx', vx).attr('cy', vy).attr('r', 4 + rand() * 4)
          .attr('fill', '#ff4400').attr('opacity', 0.9);
        detailGroup.append('circle').attr('cx', vx).attr('cy', vy).attr('r', 2 + rand() * 2)
          .attr('fill', '#ffee00').attr('opacity', 0.8);
      }
    } else if (terSub < 0.5) {
      // Ice — large polar caps, glacial ridges, crevasses
      detailGroup.append('ellipse').attr('cx', cx).attr('cy', cy - R * 0.72).attr('rx', R * 0.65).attr('ry', R * 0.5)
        .attr('fill', '#e8f8ff').attr('opacity', 0.95);
      detailGroup.append('ellipse').attr('cx', cx).attr('cy', cy + R * 0.72).attr('rx', R * 0.55).attr('ry', R * 0.42)
        .attr('fill', '#dff5ff').attr('opacity', 0.90);
      for (let i = 0; i < 10; i++) {
        const ix = cx + (rand() - 0.5) * R * 1.7;
        const iy = cy + (rand() - 0.5) * R * 1.7;
        detailGroup.append('ellipse').attr('cx', ix).attr('cy', iy)
          .attr('rx', 8 + rand() * 18).attr('ry', 4 + rand() * 8)
          .attr('fill', '#c5eaff').attr('opacity', 0.75)
          .attr('transform', `rotate(${rand() * 180}, ${ix}, ${iy})`);
      }
      // Crevasses
      for (let i = 0; i < 5; i++) {
        const cx2 = cx + (rand() - 0.5) * R * 1.4;
        const cy2 = cy + (rand() - 0.5) * R * 1.4;
        detailGroup.append('line')
          .attr('x1', cx2 - 12).attr('y1', cy2 - 6)
          .attr('x2', cx2 + 12).attr('y2', cy2 + 6)
          .attr('stroke', '#89cfef').attr('stroke-width', 1.5)
          .attr('stroke-linecap', 'round').attr('opacity', 0.7);
      }
    } else if (terSub < 0.75) {
      // Desert — dune arcs, craters with rim highlights
      for (let i = 0; i < 12; i++) {
        const dx = cx + (rand() - 0.5) * R * 1.7;
        const dy = cy + (rand() - 0.5) * R * 1.7;
        const dr = 5 + rand() * 16;
        detailGroup.append('circle').attr('cx', dx).attr('cy', dy).attr('r', dr)
          .attr('fill', '#4a2000').attr('opacity', 0.35);
        detailGroup.append('circle').attr('cx', dx).attr('cy', dy).attr('r', dr)
          .attr('fill', 'none').attr('stroke', '#ffe0a0').attr('stroke-width', 1)
          .attr('opacity', 0.5);
        // inner crater floor
        detailGroup.append('circle').attr('cx', dx + 1).attr('cy', dy + 1).attr('r', dr * 0.5)
          .attr('fill', '#7a3800').attr('opacity', 0.28);
      }
      // Dune arcs
      for (let i = 0; i < 5; i++) {
        const ax = cx + (rand() - 0.5) * R * 1.5;
        const ay = cy + (rand() - 0.5) * R * 1.5;
        detailGroup.append('path')
          .attr('d', `M${ax - 18} ${ay} Q${ax} ${ay - 12} ${ax + 18} ${ay}`)
          .attr('fill', 'none').attr('stroke', '#ffe0a0').attr('stroke-width', 1.5)
          .attr('opacity', 0.3).attr('stroke-linecap', 'round');
      }
    } else {
      // Ocean / Habitable — continents, clouds, polar shimmer
      const continentColors = ['#2d6a2e', '#3d8b40', '#4c7040', '#8d6e63', '#6d4c2e'];
      for (let i = 0; i < 7; i++) {
        const lx = cx + (rand() - 0.5) * R * 1.6;
        const ly = cy + (rand() - 0.5) * R * 1.6;
        const lr = 10 + rand() * 22;
        const lc = continentColors[Math.floor(rand() * continentColors.length)];
        detailGroup.append('circle').attr('cx', lx).attr('cy', ly).attr('r', lr)
          .attr('fill', lc).attr('opacity', 0.88);
        // coastline shimmer
        detailGroup.append('circle').attr('cx', lx).attr('cy', ly).attr('r', lr)
          .attr('fill', 'none').attr('stroke', '#66c2f5').attr('stroke-width', 1.5)
          .attr('opacity', 0.2);
      }
      // Clouds
      for (let i = 0; i < 5; i++) {
        const clx = cx + (rand() - 0.5) * R * 1.5;
        const cly = cy + (rand() - 0.5) * R * 1.5;
        detailGroup.append('ellipse').attr('cx', clx).attr('cy', cly)
          .attr('rx', 18 + rand() * 22).attr('ry', 5 + rand() * 6)
          .attr('fill', 'rgba(255,255,255,0.55)')
          .attr('transform', `rotate(${rand() * 30 - 15}, ${clx}, ${cly})`);
      }
      // Thin polar ice
      detailGroup.append('ellipse').attr('cx', cx).attr('cy', cy - R * 0.85)
        .attr('rx', R * 0.3).attr('ry', R * 0.18).attr('fill', '#e0f4ff').attr('opacity', 0.8);
    }
  }

  // ── TERMINATOR / LIMB DARKENING ──────────────────────────────────────────
  const termGrad = defs.append('radialGradient')
    .attr('id', `term-${uid}`)
    .attr('cx', '70%').attr('cy', '62%').attr('r', '55%');
  termGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(0,0,0,0)');
  termGrad.append('stop').attr('offset', '55%').attr('stop-color', 'rgba(0,0,0,0)');
  termGrad.append('stop').attr('offset', '88%').attr('stop-color', 'rgba(0,0,0,0.55)');
  termGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.80)');

  svgPlan.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', R)
    .attr('fill', `url(#term-${uid})`);

  // ── RINGS (front pass — above planet, below highlight) ───────────────────
  if (hasRings) {
    const frontClip = defs.append('clipPath').attr('id', `ring-front-clip-${uid}`);
    // Only show top half of rings (below center of planet hidden by sphere)
    frontClip.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', w).attr('height', cy);

    const ringCount = ringVariant < 0.4 ? 2 : 3;
    const ringConfigs = [
      { rx: 90, ry: 18, sw: 9, opacity: 0.7 },
      { rx: 104, ry: 22, sw: 5, opacity: 0.52 },
      { rx: 115, ry: 26, sw: 3, opacity: 0.38 },
    ];
    for (let ri = 0; ri < ringCount; ri++) {
      const rc = ringConfigs[ri];
      const ringGradFId = `ring-front-${ri}-${uid}`;
      const rg = defs.append('linearGradient')
        .attr('id', ringGradFId)
        .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
      rg.append('stop').attr('offset', '0%').attr('stop-color', darkColor).attr('stop-opacity', rc.opacity * 0.35);
      rg.append('stop').attr('offset', '28%').attr('stop-color', hex).attr('stop-opacity', rc.opacity);
      rg.append('stop').attr('offset', '52%').attr('stop-color', lightColor).attr('stop-opacity', rc.opacity);
      rg.append('stop').attr('offset', '75%').attr('stop-color', hex).attr('stop-opacity', rc.opacity);
      rg.append('stop').attr('offset', '100%').attr('stop-color', darkColor).attr('stop-opacity', rc.opacity * 0.35);

      svgPlan.append('ellipse')
        .attr('cx', cx).attr('cy', cy)
        .attr('rx', rc.rx).attr('ry', rc.ry)
        .attr('fill', 'none')
        .attr('stroke', `url(#${ringGradFId})`)
        .attr('stroke-width', rc.sw)
        .attr('transform', `rotate(${ringAngle}, ${cx}, ${cy})`)
        .attr('clip-path', `url(#ring-front-clip-${uid})`);

      // Thin bright edge line
      svgPlan.append('ellipse')
        .attr('cx', cx).attr('cy', cy)
        .attr('rx', rc.rx).attr('ry', rc.ry)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.22)')
        .attr('stroke-width', 0.8)
        .attr('transform', `rotate(${ringAngle}, ${cx}, ${cy})`)
        .attr('clip-path', `url(#ring-front-clip-${uid})`);
    }
  }

  // ── SPECULAR HIGHLIGHT ────────────────────────────────────────────────────
  const specGrad = defs.append('radialGradient')
    .attr('id', `spec-${uid}`)
    .attr('cx', '38%').attr('cy', '30%').attr('r', '35%');
  specGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.55);
  specGrad.append('stop').attr('offset', '50%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.10);
  specGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ffffff').attr('stop-opacity', 0);

  svgPlan.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', R)
    .attr('fill', `url(#spec-${uid})`);

  // ── THIN ATMOSPHERE LIMB (rim glow) ──────────────────────────────────────
  svgPlan.append('circle')
    .attr('cx', cx).attr('cy', cy).attr('r', R)
    .attr('fill', 'none')
    .attr('stroke', hex)
    .attr('stroke-width', 3.5)
    .attr('stroke-opacity', 0.30);
}

export class PlanetCard {
    constructor() {
        this.emptyEl = document.getElementById('ficha-empty');
        this.dataEl = document.getElementById('ficha-data');
        this.planet = null;
        this.animFrame = null;

        // Performance: LRU cache para os desenhos procedurais dos planetas
        this._planetDrawingCache = new Map();
        this._cacheOrder = [];
        this._MAX_CACHE = 20;

        this.fields = {
            name:        document.getElementById('pc-name'),
            badge:       document.getElementById('pc-badge'),
            methodBadge: document.getElementById('pc-method-badge'),
            year:        document.getElementById('pc-year'),
            mass:        document.getElementById('pc-mass'),
            radius:      document.getElementById('pc-radius'),
            dist:        document.getElementById('pc-dist'),
            star:        document.getElementById('pc-star'),
            gravValue:   document.getElementById('pc-gravity-val'),
            gravDesc:    document.getElementById('pc-gravity-desc'),
            gravFill:    document.getElementById('pc-gravity-fill'),
            gravMarker:  document.getElementById('pc-gravity-marker')
        };
    }

    show(planet) {
        if (!planet) return;
        this.planet = planet;

        if (this.emptyEl) this.emptyEl.style.display = 'none';
        if (this.dataEl) this.dataEl.style.display = 'block';

        this._setText('name', planet.name);
        
        const typeColor = getTypeColor(planet.type);
        if (this.fields.badge) {
            this.fields.badge.textContent = planet.type ? planet.type.toUpperCase() : 'DESCONHECIDO';
            this.fields.badge.style.color = typeColor;
            this.fields.badge.style.borderColor = typeColor;
            this.fields.badge.style.background = `${typeColor}0b`;
        }

        if (this.fields.methodBadge) {
            const mText = planet.methodPT ? planet.methodPT.toUpperCase() : 'NÃO ESTIMADO';
            this.fields.methodBadge.textContent = mText;
            const mColor = getMethodColor(planet.methodPT);
            this.fields.methodBadge.style.color = mColor;
            this.fields.methodBadge.style.borderColor = mColor;
            this.fields.methodBadge.style.background = `${mColor}0b`;
            if (mText === 'NÃO ESTIMADO') {
                this.fields.methodBadge.classList.add('val-missing');
                this.fields.methodBadge.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                this.fields.methodBadge.style.color = 'var(--text-dim)';
                this.fields.methodBadge.style.background = 'transparent';
            } else {
                this.fields.methodBadge.classList.remove('val-missing');
            }
        }

        // --- Desenho Procedural (com cache LRU) ---
        let cat = 'terrestres';
        if (planet.type === 'Gigante Gasoso') cat = 'gigantes';
        else if (planet.type === 'Netuniano') cat = 'netunos';
        else if (planet.type === 'Super-Terra') cat = 'terras';

        const drawingContainer = document.getElementById('planet-drawing-container');
        const cacheKey = planet.name;

        if (this._planetDrawingCache.has(cacheKey)) {
            // Cache hit: clonar o SVG armazenado
            drawingContainer.innerHTML = '';
            const cached = this._planetDrawingCache.get(cacheKey);
            drawingContainer.appendChild(cached.cloneNode(true));
            // Mover para o final da fila LRU
            this._cacheOrder = this._cacheOrder.filter(k => k !== cacheKey);
            this._cacheOrder.push(cacheKey);
        } else {
            // Cache miss: gerar e armazenar
            drawPlanetInFicha({
                hex: typeColor,
                category: cat,
                type: planet.type,
                name: planet.name
            });
            // Cachear o SVG gerado
            const svgNode = drawingContainer.querySelector('svg');
            if (svgNode) {
                this._planetDrawingCache.set(cacheKey, svgNode.cloneNode(true));
                this._cacheOrder.push(cacheKey);
                // Evictar entradas mais antigas se exceder o limite
                while (this._cacheOrder.length > this._MAX_CACHE) {
                    const oldest = this._cacheOrder.shift();
                    this._planetDrawingCache.delete(oldest);
                }
            }
        }

        this._setField('year', planet.year, '', { missing: 'Não estimado' });

        // Massa: "X Massas da Terra"
        if (this.fields.mass) {
            if (planet.mass !== null && planet.mass !== undefined) {
                const massFormatted = planet.mass.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
                this.fields.mass.textContent = `${massFormatted} Massas da Terra`;
                this.fields.mass.classList.remove('val-missing');
            } else {
                this.fields.mass.textContent = 'Não estimado';
                this.fields.mass.classList.add('val-missing');
            }
        }


        // Raio: "X Raios da Terra"
        if (this.fields.radius) {
            if (planet.radius !== null && planet.radius !== undefined) {
                const radiusFormatted = planet.radius.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
                this.fields.radius.textContent = `${radiusFormatted} Raios da Terra`;
                this.fields.radius.classList.remove('val-missing');
            } else {
                this.fields.radius.textContent = 'Não estimado';
                this.fields.radius.classList.add('val-missing');
            }
        }
        
        if (planet.distLY !== null && planet.distLY !== undefined) {
            this._setFieldDirect('dist', `${planet.distLY.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} anos-luz`);
        } else {
            this._setFieldDirect('dist', 'Não estimado');
        }

        this._setFieldDirect('star', planet.star || 'Desconhecida');

        this._renderGravity(planet);
        this._startAstroAnimation(planet.gravity);
    }

    hide() {
        if (this.emptyEl) this.emptyEl.style.display = 'flex';
        if (this.dataEl) this.dataEl.style.display = 'none';
        this.planet = null;
        this._stopAstroAnimation();
    }

    _setText(field, text) {
        if (this.fields[field]) this.fields[field].textContent = text || '—';
    }

    _setField(field, value, unit, opts = {}) {
        if (!this.fields[field]) return;
        const result = renderValue(value, unit, opts);
        this.fields[field].textContent = result.text;
        
        if (result.isMissing) {
            this.fields[field].classList.add('val-missing');
        } else {
            this.fields[field].classList.remove('val-missing');
        }
    }

    _setFieldDirect(field, text) {
        if (!this.fields[field]) return;
        this.fields[field].textContent = text;
        if (text === '—' || text === 'Não estimado' || text === 'Desconhecida' || text === 'Sem dados registrados') {
            this.fields[field].classList.add('val-missing');
        } else {
            this.fields[field].classList.remove('val-missing');
        }
    }

    _renderGravity(planet) {
        const g = planet.gravity;

        if (g === null || g === undefined) {
            if (this.fields.gravValue) {
                this.fields.gravValue.innerHTML = '<span style="font-size: 13px; font-weight: normal; color: var(--text-dim);">Não estimado</span>';
            }
            if (this.fields.gravDesc) this.fields.gravDesc.textContent = 'Sem dados de massa e raio para estimar a gravidade.';
            if (this.fields.gravFill) this.fields.gravFill.style.width = '0%';
            if (this.fields.gravMarker) this.fields.gravMarker.style.opacity = '0';
            return;
        }

        const mPerS2 = g * 9.81;
        if (this.fields.gravValue) {
            this.fields.gravValue.innerHTML = `<strong>${mPerS2.toFixed(2).replace('.', ',')}</strong> <span style="font-size: 13px; font-weight: 600; color: var(--text-dim); margin-left: 2px;">m/s²</span>`;
        }

        let desc = '';
        if (g > 1) {
            const pctMaior = Math.round((g - 1) * 100);
            desc = `A gravidade é cerca de ${pctMaior}% maior que a da Terra.`;
        } else if (g < 1) {
            const pctMenor = Math.round((1 - g) * 100);
            desc = `A gravidade é cerca de ${pctMenor}% menor que a da Terra.`;
        } else {
            desc = `A gravidade é idêntica à da Terra.`;
        }

        let pct = (g / 3) * 100; 
        if(pct > 100) pct = 100;

        let markerPct = (1 / 3) * 100; 

        if (this.fields.gravDesc) this.fields.gravDesc.textContent = desc;
        if (this.fields.gravFill) {
            this.fields.gravFill.style.width = `${pct}%`;
            if (g > 3) {
                this.fields.gravFill.style.background = 'linear-gradient(90deg, #E8607A, #fca5a5)';
            } else {
                this.fields.gravFill.style.background = 'linear-gradient(90deg, var(--accent-blue), #8FB4F5)';
            }
        }
        if (this.fields.gravMarker) {
            this.fields.gravMarker.style.opacity = '1';
            this.fields.gravMarker.style.left = `${markerPct}%`;
        }
    }

    _startAstroAnimation(gravity) {
        this._stopAstroAnimation();
        
        const simBox = document.getElementById('gravity-sim-box');
        const emptyEl = document.getElementById('astronaut-canvas-empty');
        if (!simBox) return;
        
        if (gravity === null || gravity === undefined) {
            simBox.style.display = 'none';
            if (emptyEl) {
                emptyEl.style.display = 'flex';
            }
            return;
        } else {
            simBox.style.display = 'flex';
            if (emptyEl) {
                emptyEl.style.display = 'none';
            }
        }
        
        const astronaut = document.getElementById('sim-astronaut');
        const shadow = document.getElementById('sim-shadow');
        if (!astronaut || !shadow) return;
        
        // Set transform-origin to bottom center so squash and stretch occurs from feet
        astronaut.style.transformOrigin = '50% 100%';
        
        let time = 0;
        
        // Clamp gravity to a reasonable range for simulation presentation (0.05 to 12)
        const clampedG = Math.max(0.05, Math.min(gravity, 12)); 
        const ASTRO_BASE_SPEED = 0.035;
        
        // Height: High gravity -> Low jump height. Low gravity -> High jump height.
        // The container height is now 90px, astronaut is 40px, floor is 2px.
        // So maximum jump height we can fit before touching the ceiling:
        // 90 - 40 - 2 = 48px. We increase and limit the jump height to 44px.
        const jumpHeight = Math.max(2, Math.min(44, 20 / Math.sqrt(clampedG)));
        
        // Speed: High gravity -> fast animation (rapid cycle). Low gravity -> slow, floaty animation.
        const speedFactor = Math.sqrt(clampedG);
        
        const loop = () => {
            time += ASTRO_BASE_SPEED * speedFactor;
            
            // Jump calculation using absolute sine wave for elastic collision bounce
            const sinVal = Math.sin(time);
            const yRatio = Math.abs(sinVal);
            const bounce = yRatio * jumpHeight;
            
            // Squash and Stretch calculations
            let sx = 1.0;
            let sy = 1.0;
            
            // Contact factor (1 near the ground, 0 in the air)
            const contact = Math.max(0, 1 - yRatio * 4);
            
            if (contact > 0) {
                // Squashing on impact: depends on gravity level (higher gravity = squash harder)
                const squashAmount = Math.max(0.02, Math.min(0.3, 0.08 * Math.sqrt(clampedG)));
                sy = 1 - squashAmount * contact;
                sx = 1 + squashAmount * contact;
            } else {
                // Stretching in the air: higher stretch in low gravity (floaty/fluid)
                const airStretch = Math.max(0.01, Math.min(0.12, 0.04 / Math.sqrt(clampedG)));
                const stretchAmount = airStretch * yRatio;
                sy = 1 + stretchAmount;
                sx = 1 - stretchAmount * 0.5;
            }
            
            // Translate astronaut up and apply scale deformation
            astronaut.style.transform = `translateX(-50%) translateY(${-bounce}px) scale(${sx}, ${sy})`;
            
            // Scale and fade shadow based on height
            if (shadow) {
                const shadowScale = Math.max(0.25, 1 - (bounce / 44) * 0.75);
                const shadowOpacity = Math.max(0.1, 0.6 - (bounce / 44) * 0.5);
                shadow.style.transform = `translateX(-50%) scale(${shadowScale})`;
                shadow.style.opacity = shadowOpacity;
            }
            
            this.animFrame = requestAnimationFrame(loop);
        };
        loop();
    }

    _stopAstroAnimation() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
    }
}
