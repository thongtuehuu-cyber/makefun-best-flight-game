// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh flight for a fixed number of steps, steered by a
// simple autopilot (bank toward the next ring, pitch toward its height, full
// throttle on the way out, gentle on the final), so the frame is what a real
// flight looks like and the same seed always gives the same frame.

import { RUNWAY_END, STEP } from './config.js';
import { EVENT_CRASHED, EVENT_LANDED } from './flight.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 300;

/** How the autopilot steers: how hard it banks for a heading error, in stick units per radian. */
const BANK_GAIN = 1.6;
/** The bank gain on the final, where the strip's centreline leaves no room to wander. */
const BANK_GAIN_FINAL = 6;
/** How hard it pitches for an altitude error, in stick units per metre. */
const PITCH_GAIN = 0.02;

/**
 * The stick that flies the plane toward `target` (an {x, y, z} point):
 * bank toward the heading to the target and pitch toward its height. On the
 * final the nose flies a staged descent — steep until low, gentle, then a
 * small flare — so the plane settles onto the strip instead of floating
 * above it or sailing past its far end.
 */
export function autopilotStick(plane, target) {
  const desiredHeading = Math.atan2(target.x - plane.x, target.z - plane.z);
  let headingError = desiredHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const gain = target.final ? BANK_GAIN_FINAL : BANK_GAIN;
  const roll = Math.max(-1, Math.min(1, headingError * gain));
  let pitch;
  if (target.final) {
    // Steep until low, then gentle all the way down: the last ring leaves
    // the plane high, and the strip is only 500 m long, so the nose goes
    // down while the wings sort the centreline out — but not so steep that
    // she reaches the ground before the line-up is done.
    pitch = plane.y > 12 ? -0.8 : -0.2;
  } else {
    const climb = target.y - plane.y;
    pitch = Math.max(-1, Math.min(1, climb * PITCH_GAIN + 0.15));
  }
  return { pitch, roll, throttle: 0 };
}

/**
 * The throttle stick: hold a cruise throttle on the way out and a low one on
 * the final, easing toward the target instead of slamming the lever.
 */
function autopilotThrottle(plane, target) {
  let cruise = 0.85;
  if (target.final) {
    // Slow on the final: more seconds per metre for the descent and the line-up.
    cruise = 0.15;
  }
  if (plane.throttle < cruise - 0.05) return 1;
  if (plane.throttle > cruise + 0.05) return -1;
  return 0;
}

/**
 * Where the autopilot is aiming right now: the next ring, or a near point on
 * the far runway's centreline that always stays ahead of the plane. Aiming
 * near — not at the far end — turns a lateral offset into a real heading
 * correction, so the final flies down the strip and settles onto it instead
 * of landing parallel to it, off the asphalt.
 */
function autopilotTarget(flight) {
  const ring = flight.currentRing();
  if (ring) return { x: ring.x, y: ring.y, z: ring.z, final: false };
  const plane = flight.state.plane;
  return { x: RUNWAY_END.x, y: 0, z: plane.z + 180, final: true };
}

function fly(flight, seconds, throttle) {
  let events = 0;
  for (let index = 0; index < seconds / STEP; index += 1) {
    const target = autopilotTarget(flight);
    const stick = autopilotStick(flight.state.plane, target);
    stick.throttle = autopilotThrottle(flight.state.plane, target);
    events = flight.step(STEP, stick, false);
    if (events & (EVENT_LANDED | EVENT_CRASHED)) break;
  }
  return events;
}

/**
 * Set `flight` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, flight) {
  flight.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      flight.step(STEP, { pitch: 0, roll: 0, throttle: 0 }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    fly(flight, PLAY_SECONDS, 0.8);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  fly(flight, END_LIMIT_SECONDS, 0.8);
  return { screen: SCREEN_OVER, best: flight.state.score };
}
