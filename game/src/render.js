// Drawing only: the flight state and the current screen in, pixels out. A
// chase camera sits behind the plane and looks down the valley; the ground is
// painted as projected strips of the terrain, the sky holds mountains and
// clouds, the plane is drawn from behind, and the bottom of the screen is a
// lit instrument panel with the altitude, speed and heading on the HUD. The
// 1280x720 playfield is scaled to fit the window and centred.

import { FIELD, FONT, GAME_SUBTITLE, GAME_TITLE, PALETTE, RING_COUNT } from './config.js';
import { groundKindAt } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Perspective focal length in logical pixels (about a 65 degree field of view). */
const FOCAL = 560;
/** Where the horizon sits on a level flight, in logical pixels from the top. */
const HORIZON_BASE = 300;
/** How far ahead the ground is painted, in metres. */
const FAR = 1800;
/** Ground strips per frame and lateral patches per strip. */
const ROWS = 46;
const SEGMENTS = 10;

const GROUND_COLORS = {
  runway: '#3c4148',
  'runway-line': '#e8e4d2',
  road: '#5a5f66',
  river: '#3f7fb8',
  town: '#b09a7a',
  'town-roof': '#8a5f4d',
  'field-green': '#5d8a3c',
  'field-light': '#7ba24a',
  'field-wheat': '#c2a95c',
  'field-forest': '#2f5d2a',
  'field-dry': '#9aa05a',
};

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mix(hexA, hexB, amount) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * amount);
  const g = Math.round(a[1] + (b[1] - a[1]) * amount);
  const bl = Math.round(a[2] + (b[2] - a[2]) * amount);
  return `rgb(${r},${g},${bl})`;
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function headingText(heading) {
  const degrees = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  return `${String(Math.round(degrees)).padStart(3, '0')}°`;
}

function compassPoint(heading) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const degrees = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  return points[Math.round(degrees / 45) % 8];
}

export function createRenderer(canvas, terrain) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  let bannerText = '';
  let bannerUntil = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight, baseline) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Project a world point into logical screen space; null when behind the camera. */
  function project(wx, wy, wz, cam, horizonY) {
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const dz = wz - cam.z;
    const forward = dx * cam.sinH + dz * cam.cosH;
    if (forward < 2) return null;
    const right = dx * cam.cosH - dz * cam.sinH;
    return {
      x: FIELD.width / 2 + (right / forward) * FOCAL,
      y: horizonY - (dy / forward) * FOCAL,
      dist: forward,
    };
  }

  function drawSky(cam, horizonY) {
    const gradient = context.createLinearGradient(0, 0, 0, horizonY + 40);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, horizonY + 40);
    // Sun, upper right, with a soft glow.
    const glow = context.createRadialGradient(1060, 108, 8, 1060, 108, 130);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,243,196,0.45)');
    glow.addColorStop(1, 'rgba(255,243,196,0)');
    context.fillStyle = glow;
    context.fillRect(920, -20, 280, 260);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1060, 108, 26, 0, Math.PI * 2);
    context.fill();
  }

  function drawMountains(cam, horizonY) {
    for (const peak of terrain.mountains) {
      const base = project(peak.x, 0, peak.z, cam, horizonY);
      if (!base) continue;
      const heightPx = (peak.height / base.dist) * FOCAL;
      const halfPx = (peak.halfWidth / base.dist) * FOCAL;
      if (heightPx < 4) continue;
      const haze = Math.min(0.65, base.dist / 5200);
      context.fillStyle = mix(PALETTE.mountainNear, PALETTE.skyHorizon, haze);
      context.beginPath();
      context.moveTo(base.x - halfPx, base.y + 2);
      context.lineTo(base.x, base.y - heightPx);
      context.lineTo(base.x + halfPx, base.y + 2);
      context.closePath();
      context.fill();
      // Snow cap on the taller peaks.
      if (peak.height > 480) {
        context.fillStyle = 'rgba(255,255,255,0.75)';
        context.beginPath();
        context.moveTo(base.x - halfPx * 0.24, base.y - heightPx * 0.76);
        context.lineTo(base.x, base.y - heightPx);
        context.lineTo(base.x + halfPx * 0.24, base.y - heightPx * 0.76);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawGround(cam, horizonY) {
    const zStart = cam.z + 14;
    const edges = [];
    for (let index = 0; index <= ROWS; index += 1) {
      const t = index / ROWS;
      edges.push(zStart + (FAR - 14) * Math.pow(t, 2.1));
    }
    for (let row = 0; row < ROWS; row += 1) {
      const z0 = edges[row];
      const z1 = edges[row + 1];
      const zMid = (z0 + z1) / 2;
      const depth = zMid - cam.z;
      const halfWidth = (depth * (FIELD.width / 2) / FOCAL) * 1.12 + 80;
      const haze = Math.min(0.55, depth / FAR);
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        const x0 = cam.x - halfWidth + (2 * halfWidth * segment) / SEGMENTS;
        const x1 = cam.x - halfWidth + (2 * halfWidth * (segment + 1)) / SEGMENTS;
        const xMid = (x0 + x1) / 2;
        const kind = groundKindAt(terrain, xMid, zMid);
        const color = mix(GROUND_COLORS[kind], PALETTE.skyHorizon, haze);
        const a = project(x0, 0, z0, cam, horizonY);
        const b = project(x1, 0, z0, cam, horizonY);
        const c = project(x1, 0, z1, cam, horizonY);
        const d = project(x0, 0, z1, cam, horizonY);
        if (!a || !b || !c || !d) continue;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.lineTo(c.x, c.y);
        context.lineTo(d.x, d.y);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawClouds(cam, horizonY, time) {
    context.fillStyle = PALETTE.cloud;
    for (const cloud of terrain.clouds) {
      const driftedX = cloud.x + time * cloud.drift;
      const at = project(driftedX, cloud.y, cloud.z, cam, horizonY);
      if (!at || at.x < -200 || at.x > FIELD.width + 200 || at.y < -80 || at.y > horizonY) continue;
      const scale = (cloud.scale / at.dist) * FOCAL;
      if (scale < 3) continue;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.ellipse(at.x, at.y, scale, scale * 0.36, 0, 0, Math.PI * 2);
      context.ellipse(at.x - scale * 0.55, at.y + scale * 0.1, scale * 0.6, scale * 0.28, 0, 0, Math.PI * 2);
      context.ellipse(at.x + scale * 0.55, at.y + scale * 0.08, scale * 0.62, scale * 0.3, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawRings(state, cam, horizonY, time) {
    for (const ring of state.rings) {
      if (ring.state === 'missed') continue;
      const at = project(ring.x, ring.y, ring.z, cam, horizonY);
      // A ring right beside the plane (just flown through, or the next one
      // as the nose reaches it) projects to a circle thousands of pixels
      // wide, and its thick stroke paints a giant band across the whole
      // sky. Skip anything that close, and cap the radius either way.
      if (!at || at.dist > 1700 || at.dist < 60) continue;
      const radiusPx = Math.min(320, (ring.radius / at.dist) * FOCAL);
      if (radiusPx < 2) continue;
      const isCurrent = state.rings[state.ringIndex] === ring;
      const pulse = isCurrent ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
      context.globalAlpha = ring.state === 'next' ? pulse : 0.45;
      context.strokeStyle = ring.state === 'next' ? PALETTE.ringGlow : PALETTE.ringDone;
      context.lineWidth = Math.max(2, radiusPx * 0.16);
      context.beginPath();
      context.arc(at.x, at.y, radiusPx, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = ring.state === 'next' ? PALETTE.ring : PALETTE.ringDone;
      context.lineWidth = Math.max(1.5, radiusPx * 0.07);
      context.beginPath();
      context.arc(at.x, at.y, radiusPx * 0.82, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
      if (isCurrent && radiusPx > 14) {
        text(`${Math.round(at.dist)} m`, at.x, at.y + radiusPx + 24, 18, PALETTE.text, 'center', '600');
      }
    }
  }

  function drawPlane(plane) {
    const cx = FIELD.width / 2;
    const cy = 478;
    context.save();
    context.translate(cx, cy);
    context.rotate(plane.bank * 0.85);
    // Wings, swept back, trim red on the tips.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-18, -6);
    context.lineTo(-168, 26);
    context.lineTo(-168, 40);
    context.lineTo(-14, 22);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(18, -6);
    context.lineTo(168, 26);
    context.lineTo(168, 40);
    context.lineTo(14, 22);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeTrim;
    context.fillRect(-168, 26, 22, 14);
    context.fillRect(146, 26, 22, 14);
    // Tail fin and stabilisers.
    context.fillStyle = PALETTE.planeTrim;
    context.beginPath();
    context.moveTo(-7, 34);
    context.lineTo(0, -16);
    context.lineTo(7, 34);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-52, 44);
    context.lineTo(-96, 58);
    context.lineTo(-96, 66);
    context.lineTo(-46, 58);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(52, 44);
    context.lineTo(96, 58);
    context.lineTo(96, 66);
    context.lineTo(46, 58);
    context.closePath();
    context.fill();
    // Fuselage: narrow at the nose (far, up-screen), wide at the tail.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-13, -72);
    context.lineTo(13, -72);
    context.lineTo(24, 62);
    context.lineTo(-24, 62);
    context.closePath();
    context.fill();
    // Canopy glass, engine exhausts and navigation lights.
    context.fillStyle = PALETTE.planeGlass;
    context.beginPath();
    context.ellipse(0, -48, 9, 20, 0, 0, Math.PI * 2);
    context.fill();
    const glow = 0.35 + plane.throttle * 0.65;
    context.fillStyle = `rgba(255,${Math.round(140 + 60 * plane.throttle)},40,${glow})`;
    context.beginPath();
    context.arc(-13, 58, 6, 0, Math.PI * 2);
    context.arc(13, 58, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ff3b30';
    context.beginPath();
    context.arc(-168, 33, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2fd95c';
    context.beginPath();
    context.arc(168, 33, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawGauge(cx, cy, radius, label, valueText) {
    context.fillStyle = PALETTE.gaugeFace;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(label, cx, cy + radius - 8, 13, PALETTE.muted, 'center', '600');
    text(valueText, cx, cy + 6, 20, PALETTE.text, 'center', '700');
  }

  function drawNeedleGauge(cx, cy, radius, fraction, label, valueText) {
    drawGauge(cx, cy, radius, label, valueText);
    const angle = -Math.PI * 0.75 + fraction * Math.PI * 1.5;
    context.strokeStyle = PALETTE.gaugeNeedle;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * (radius - 12), cy + Math.sin(angle) * (radius - 12));
    context.stroke();
    for (let tick = 0; tick <= 6; tick += 1) {
      const tickAngle = -Math.PI * 0.75 + (tick / 6) * Math.PI * 1.5;
      context.strokeStyle = PALETTE.gaugeTick;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cx + Math.cos(tickAngle) * (radius - 6), cy + Math.sin(tickAngle) * (radius - 6));
      context.lineTo(cx + Math.cos(tickAngle) * (radius - 13), cy + Math.sin(tickAngle) * (radius - 13));
      context.stroke();
    }
  }

  function drawArtificialHorizon(cx, cy, radius, pitch, bank) {
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    context.translate(cx, cy);
    context.rotate(bank);
    const shift = Math.max(-radius, Math.min(radius, pitch * radius * 1.4));
    context.fillStyle = '#3f7fc9';
    context.fillRect(-radius, -radius + shift, radius * 2, radius - shift);
    context.fillStyle = '#7a5a34';
    context.fillRect(-radius, shift, radius * 2, radius - shift + radius);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius, shift);
    context.lineTo(radius, shift);
    context.stroke();
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.stroke();
    // Fixed wings marker on the horizon.
    context.strokeStyle = PALETTE.gaugeNeedle;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(cx - 16, cy);
    context.lineTo(cx - 4, cy);
    context.moveTo(cx + 4, cy);
    context.lineTo(cx + 16, cy);
    context.stroke();
    text('ATT', cx, cy + radius - 8, 13, PALETTE.muted, 'center', '600');
  }

  function drawBar(x, y, width, height, fraction, color, label) {
    context.fillStyle = '#0a0e16';
    context.fillRect(x, y, width, height);
    context.fillStyle = color;
    context.fillRect(x, y + height * (1 - fraction), width, height * fraction);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(x, y, width, height);
    text(label, x + width / 2, y + height + 16, 12, PALETTE.muted, 'center', '600');
  }

  function drawDashboard(state) {
    const plane = state.plane;
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, 600, FIELD.width, 120);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, 600, FIELD.width, 2);
    drawNeedleGauge(120, 660, 44, plane.speed / 120, 'SPD', `${Math.round(plane.speed * 3.6)}`);
    drawArtificialHorizon(300, 660, 44, plane.pitch, plane.bank);
    drawNeedleGauge(480, 660, 44, Math.min(1, plane.y / 300), 'ALT', `${Math.round(plane.y)}`);
    // Heading compass strip.
    const compassX = 640;
    const compassY = 660;
    text('HDG', compassX, compassY - 34, 13, PALETTE.muted, 'center', '600');
    text(`${headingText(plane.heading)} ${compassPoint(plane.heading)}`, compassX, compassY + 8, 26, PALETTE.text, 'center', '700');
    context.strokeStyle = PALETTE.gaugeTick;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(compassX - 70, compassY + 26);
    context.lineTo(compassX + 70, compassY + 26);
    context.stroke();
    context.fillStyle = PALETTE.gaugeNeedle;
    context.beginPath();
    context.moveTo(compassX, compassY + 18);
    context.lineTo(compassX - 5, compassY + 26);
    context.lineTo(compassX + 5, compassY + 26);
    context.closePath();
    context.fill();
    // Fuel and throttle bars.
    const fuelColor = plane.fuel <= 25 ? PALETTE.gaugeRed : plane.fuel <= 50 ? PALETTE.gaugeAmber : PALETTE.gaugeGreen;
    drawBar(1060, 622, 26, 70, plane.fuel / 100, fuelColor, 'FUEL');
    drawBar(1110, 622, 26, 70, plane.throttle, PALETTE.gaugeTick, 'THR');
    text(`${Math.round(plane.fuel)}%`, 1073, 614, 14, PALETTE.text, 'center', '700');
  }

  function drawHud(state) {
    const plane = state.plane;
    text(`ALT ${Math.round(plane.y)} m`, 24, 18, 26, PALETTE.text, 'left', '700', 'top');
    text(`SPD ${Math.round(plane.speed * 3.6)} km/h`, 24, 50, 20, PALETTE.text, 'left', '600', 'top');
    const ring = state.rings[state.ringIndex];
    const ringLabel = ring
      ? `RING ${state.ringIndex + 1}/${RING_COUNT} — ${Math.max(0, Math.round(ring.z - plane.z))} m`
      : `ALL RINGS DONE — LAND ON THE FAR STRIP`;
    text(ringLabel, FIELD.width / 2, 18, 22, PALETTE.gold, 'center', '700', 'top');
    text(`SCORE ${state.score}`, FIELD.width - 24, 18, 26, PALETTE.text, 'right', '700', 'top');
    text(`TIME ${formatTime(state.elapsed)}`, FIELD.width - 24, 50, 20, PALETTE.text, 'right', '600', 'top');
    if (plane.fuel <= 25 && plane.fuel > 0) {
      text('LOW FUEL', FIELD.width / 2, 52, 20, PALETTE.gaugeRed, 'center', '700', 'top');
    } else if (plane.fuel <= 0) {
      text('FUEL EMPTY — GLIDING', FIELD.width / 2, 52, 20, PALETTE.gaugeRed, 'center', '700', 'top');
    }
    if (bannerText && performance.now() < bannerUntil) {
      context.globalAlpha = Math.min(1, (bannerUntil - performance.now()) / 500);
      text(bannerText, FIELD.width / 2, 220, 34, PALETTE.gold, 'center', '700');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2 - 90;
    context.fillStyle = 'rgba(10,14,22,0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 72, 46, titleColor || PALETTE.text, 'center', '800');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 122 + index * 32, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center', '600');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time) {
    const plane = state.plane;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    const cam = {
      x: plane.x - Math.sin(plane.heading) * 12,
      y: plane.y + 3.5,
      z: plane.z - Math.cos(plane.heading) * 12,
      sinH: Math.sin(plane.heading),
      cosH: Math.cos(plane.heading),
    };
    const horizonY = HORIZON_BASE + plane.pitch * FOCAL * 0.55;

    drawSky(cam, horizonY);
    // The world rolls with the plane, the HUD does not — but only a quarter
    // of the bank, so the horizon stays readable while the turn still reads.
    context.save();
    context.translate(FIELD.width / 2, HORIZON_BASE);
    context.rotate(plane.bank * 0.25);
    context.translate(-FIELD.width / 2, -HORIZON_BASE);
    drawMountains(cam, horizonY);
    drawGround(cam, horizonY);
    drawClouds(cam, horizonY, time);
    drawRings(state, cam, horizonY, time);
    context.restore();

    drawPlane(plane);
    drawDashboard(state);
    if (screen === SCREEN_TITLE) {
      const lines = [
        GAME_SUBTITLE,
        'Fly through all 10 rings, then land on the far strip.',
        'Arrows / WASD to steer · Mouse steers too',
        'Shift throttle up · Ctrl throttle down · P pauses',
        `Best score ${best}`,
      ];
      drawPanel(GAME_TITLE, lines, 'Press Space or click to fly');
    } else {
      drawHud(state);
      if (screen === SCREEN_PAUSED) {
        drawPanel('Paused', ['The valley will wait for you.'], 'Press P to resume');
      } else if (screen === SCREEN_OVER) {
        if (state.landed) {
          const lines = [
            `Rings ${state.ringsHit}/${RING_COUNT} — ${state.ringsHit * 100 + state.ringsPerfect * 50} points`,
            `Landing bonus +${state.landingBonus} · Time bonus +${state.timeBonus} · Fuel bonus +${state.fuelBonus}`,
            `Score ${state.score} · Best ${best}`,
          ];
          drawPanel('DELIVERED!', lines, 'Press Space or click to fly again', PALETTE.gold);
        } else {
          const lines = [
            state.crashReason,
            `Rings ${state.ringsHit}/${RING_COUNT} · Score ${state.score} · Best ${best}`,
          ];
          drawPanel('CRASHED', lines, 'Press Space or click to try again', PALETTE.gaugeRed);
        }
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** A short message flashed over the sky, such as a ring bonus. */
    banner(message) {
      bannerText = message;
      bannerUntil = performance.now() + 1600;
    },
  };
}
