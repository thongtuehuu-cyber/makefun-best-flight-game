// Boot and the one loop: input is read every frame, the flight advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over.
//
// ?seed=N fixes the valley and the rings. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createTerrain } from './terrain.js';
import { createFlight, EVENT_CRASHED, EVENT_FUEL_EMPTY, EVENT_FUEL_LOW, EVENT_LANDED, EVENT_PERFECT, EVENT_RING } from './flight.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const flight = createFlight(seed);
const renderer = createRenderer(canvas, terrain);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight);
  let painted = 0;
  function paint() {
    renderer.draw(flight.state, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each ring.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    flight.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce('Flying. Ten rings, then land on the far strip.');
  }

  function endGame(landed) {
    screen = SCREEN_OVER;
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    announce(landed
      ? `Delivered. Score ${flight.state.score}. Best ${best}.`
      : `Crashed. Score ${flight.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      flight.step(STEP, { pitch: 0, roll: 0, throttle: 0 }, true);
      return;
    }
    const events = flight.step(STEP, input.stick(), false);
    if (events & EVENT_RING) {
      const perfect = events & EVENT_PERFECT;
      renderer.banner(perfect ? `PERFECT RING! +${100 + 50}` : `RING ${flight.state.ringsHit}! +100`);
      audio.chime(Boolean(perfect));
      announce(`Ring ${flight.state.ringsHit} of 10. Score ${flight.state.score}.`);
    }
    if (events & EVENT_FUEL_LOW) announce('Low fuel.');
    if (events & EVENT_FUEL_EMPTY) announce('Fuel empty. Gliding.');
    if (events & EVENT_LANDED) {
      audio.fanfare();
      endGame(true);
    } else if (events & EVENT_CRASHED) {
      audio.thud();
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const plane = flight.state.plane;
    audio.engine(plane.throttle, plane.speed, screen === SCREEN_PLAY);
    renderer.draw(flight.state, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting the plane fly on unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sky Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
