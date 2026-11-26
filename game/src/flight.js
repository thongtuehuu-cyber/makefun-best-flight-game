// The flight model and the mission state, with no drawing and no browser in
// it: the plane's position, speed, pitch, bank and fuel, the rings, the
// landing and the crash. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the flight code
// knowing about screens or sound.

import { FUEL, PLANE, RING_COUNT, RING_FIRST_Z, RING_PERFECT_RADIUS, RING_RADIUS, RING_SPACING, RUNWAY_END, RUNWAY_START, SCORE } from './config.js';

export const EVENT_RING = 1;
export const EVENT_PERFECT = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_FUEL_LOW = 16;
export const EVENT_FUEL_EMPTY = 32;

const DEG = Math.PI / 180;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function lerpAngle(current, target, rate, dt) {
  const diff = target - current;
  const step = clamp(diff, -rate * dt, rate * dt);
  return current + step;
}

export function createFlight(seed) {
  const random = (() => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const rings = [];
  let ringX = 0;
  for (let index = 0; index < RING_COUNT; index += 1) {
    // The course funnels toward the far runway: the rings wander widely out
    // in the valley and close in as the strip approaches, so the final
    // approach is a line-up, not a swerve.
    const maxOffset = 230 - (230 - 60) * (index / (RING_COUNT - 1));
    ringX = clamp(ringX + (random() - 0.5) * 260, -maxOffset, maxOffset);
    rings.push({
      x: ringX,
      y: 70 + random() * 85,
      z: RING_FIRST_Z + index * RING_SPACING,
      radius: RING_RADIUS,
      state: 'next',
    });
  }

  const plane = {
    x: RUNWAY_START.x,
    y: 0,
    z: 60,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.start,
    verticalSpeed: 0,
  };

  const state = {
    plane,
    rings,
    ringIndex: 0,
    score: 0,
    ringsHit: 0,
    ringsPerfect: 0,
    elapsed: 0,
    landed: false,
    crashed: false,
    crashReason: '',
    fuelWarned: false,
    fuelEmpty: false,
    landingBonus: 0,
    timeBonus: 0,
    fuelBonus: 0,
    airborne: false,
  };

  function reset() {
    plane.x = RUNWAY_START.x;
    plane.y = 0;
    plane.z = 60;
    plane.heading = 0;
    plane.pitch = 0;
    plane.bank = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.fuel = FUEL.start;
    plane.verticalSpeed = 0;
    for (const ring of rings) ring.state = 'next';
    state.ringIndex = 0;
    state.score = 0;
    state.ringsHit = 0;
    state.ringsPerfect = 0;
    state.elapsed = 0;
    state.landed = false;
    state.crashed = false;
    state.crashReason = '';
    state.fuelWarned = false;
    state.fuelEmpty = false;
    state.landingBonus = 0;
    state.timeBonus = 0;
    state.fuelBonus = 0;
    state.airborne = false;
  }

  function currentRing() {
    return state.ringIndex < rings.length ? rings[state.ringIndex] : null;
  }

  /**
   * One fixed step. `stick` is { pitch: -1..1 (up positive), roll: -1..1
   * (right positive), throttle: -1..1 } and `harmless` keeps the title
   * screen's backdrop flying without scoring, landing or crashing.
   */
  function step(dt, stick, harmless) {
    let events = 0;
    if (state.landed || state.crashed) return events;
    state.elapsed += dt;

    if (!state.fuelEmpty && !harmless) {
      plane.throttle = clamp(plane.throttle + stick.throttle * dt * 0.9, 0, 1);
      plane.fuel = Math.max(0, plane.fuel - (FUEL.idleBurn + FUEL.throttleBurn * plane.throttle) * dt);
      if (plane.fuel <= 0) {
        state.fuelEmpty = true;
        plane.throttle = 0;
        events |= EVENT_FUEL_EMPTY;
      } else if (plane.fuel <= FUEL.lowWarning && !state.fuelWarned) {
        state.fuelWarned = true;
        events |= EVENT_FUEL_LOW;
      }
    }

    // On the ground the throttle alone sets the speed (idle throttle means
    // standing still); in the air the wing needs at least the minimum speed.
    const targetSpeed = plane.y <= 0.1
      ? plane.throttle * PLANE.maxSpeed
      : PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += clamp(targetSpeed - plane.speed, -26 * dt, 18 * dt);

    const targetPitch = stick.pitch >= 0
      ? stick.pitch * PLANE.maxPitchUp * DEG
      : stick.pitch * PLANE.maxPitchDown * DEG;
    const targetBank = stick.roll * PLANE.maxBank * DEG;
    plane.pitch = lerpAngle(plane.pitch, targetPitch, PLANE.pitchRate, dt);
    plane.bank = lerpAngle(plane.bank, targetBank, PLANE.bankRate, dt);

    plane.heading += Math.tan(plane.bank) * PLANE.turnFactor * dt * (plane.speed / 70);
    while (plane.heading > Math.PI) plane.heading -= Math.PI * 2;
    while (plane.heading < -Math.PI) plane.heading += Math.PI * 2;
    plane.verticalSpeed = plane.speed * Math.sin(plane.pitch);
    if (plane.speed < PLANE.stallSpeed && plane.y > 2) plane.verticalSpeed -= (PLANE.stallSpeed - plane.speed) * 0.35;
    // She needs takeoff speed before the wings bite: below 45 m/s on the ground she stays put.
    if (plane.y <= 0.1 && plane.speed < 45) plane.verticalSpeed = 0;

    const forwardX = Math.sin(plane.heading);
    const forwardZ = Math.cos(plane.heading);
    const prevZ = plane.z;
    plane.x += forwardX * plane.speed * dt;
    plane.z += forwardZ * plane.speed * dt;
    plane.y += plane.verticalSpeed * dt;
    if (plane.y < 0) plane.y = 0;
    if (plane.y > 2) state.airborne = true;

    const ring = currentRing();
    if (ring !== null && prevZ < ring.z && plane.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < ring.radius) {
        ring.state = distance < RING_PERFECT_RADIUS ? 'perfect' : 'hit';
        state.ringsHit += 1;
        state.score += SCORE.ring;
        events |= EVENT_RING;
        if (ring.state === 'perfect') {
          state.ringsPerfect += 1;
          state.score += SCORE.ringPerfect;
          events |= EVENT_PERFECT;
        }
      } else {
        ring.state = 'missed';
      }
      state.ringIndex += 1;
    }

    if (harmless) return events;

    // Touching the ground only matters once she has left it: on the start
    // strip she is taxiing, not crashing.
    if (state.airborne && plane.y <= 0.6) {
      const onEndRunway = plane.z >= RUNWAY_END.zMin && plane.z <= RUNWAY_END.zMax
        && Math.abs(plane.x - RUNWAY_END.x) <= RUNWAY_END.halfWidth + 3;
      const gentle = Math.abs(plane.verticalSpeed) <= 7 && plane.speed <= 60 && Math.abs(plane.bank) <= 20 * DEG;
      if (onEndRunway && gentle && state.ringIndex >= RING_COUNT) {
        state.landed = true;
        state.landingBonus = SCORE.landing;
        state.timeBonus = Math.max(0, Math.round(SCORE.timeBonusMax * (1 - state.elapsed / SCORE.timeBonusSeconds)));
        state.fuelBonus = Math.round(plane.fuel * SCORE.fuelPerUnit);
        state.score += state.landingBonus + state.timeBonus + state.fuelBonus;
        events |= EVENT_LANDED;
      } else if (onEndRunway && gentle && state.ringIndex < RING_COUNT) {
        // Touching the far runway early is a rough landing, not a delivery.
        state.crashed = true;
        state.crashReason = 'You put her down on the far strip before the last ring.';
        events |= EVENT_CRASHED;
      } else {
        state.crashed = true;
        state.crashReason = plane.fuel <= 0
          ? 'Out of fuel — she glided into the valley floor.'
          : 'You hit the ground.';
        events |= EVENT_CRASHED;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, currentRing };
}
