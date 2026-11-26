// Keyboard and mouse input. Held keys give the stick (pitch and roll) and the
// throttle; one-shot presses (start, restart, pause) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. Moving the mouse steers toward the pointer; a click
// confirms, like Space.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft', 'KeyA']);
const ROLL_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight', 'KeyC', 'Minus', 'NumpadSubtract']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let pitchUp = false;
  let pitchDown = false;
  let rollLeft = false;
  let rollRight = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mouseSeenAt = 0;

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (ROLL_LEFT.has(event.code)) rollLeft = true;
    else if (ROLL_RIGHT.has(event.code)) rollRight = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (ROLL_LEFT.has(event.code)) rollLeft = false;
    else if (ROLL_RIGHT.has(event.code)) rollRight = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    pitchUp = false;
    pitchDown = false;
    rollLeft = false;
    rollRight = false;
    throttleUp = false;
    throttleDown = false;
    mouseActive = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    mouseY = event.clientY / window.innerHeight - 0.5;
    mouseActive = true;
    mouseSeenAt = performance.now();
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /**
     * The stick this frame: pitch -1..1 (up positive), roll -1..1 (right
     * positive), throttle -1..1. The mouse steers only while the keyboard is
     * quiet and the pointer moved in the last two seconds.
     */
    stick() {
      const keyboardPitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
      const keyboardRoll = (rollRight ? 1 : 0) - (rollLeft ? 1 : 0);
      let pitch = keyboardPitch;
      let roll = keyboardRoll;
      if (keyboardPitch === 0 && keyboardRoll === 0 && mouseActive
        && performance.now() - mouseSeenAt < 2000) {
        pitch = Math.max(-1, Math.min(1, -mouseY * 2.4));
        roll = Math.max(-1, Math.min(1, mouseX * 2.4));
      }
      return {
        pitch,
        roll,
        throttle: (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
