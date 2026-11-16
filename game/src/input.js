// Quartz Quest — keyboard + on-screen touch buttons, read every frame.
// SPDX-License-Identifier: MIT

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const JUMP_KEYS = new Set(['ArrowUp', 'KeyW', 'Space']);

export function createInput(canvas) {
  const keys = new Set();
  let jumpQueued = false;
  let actions = 0;
  const touch = { left: false, right: false, jump: false };
  let touchJumpQueued = false;

  function onKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (JUMP_KEYS.has(event.code)) jumpQueued = true;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
    touch.left = false;
    touch.right = false;
    touch.jump = false;
  }

  function bindButton(id, field) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (event) => {
      event.preventDefault();
      if (field === 'jump' && !touch.jump) touchJumpQueued = true;
      touch[field] = true;
    };
    const up = (event) => {
      event.preventDefault();
      touch[field] = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  bindButton('btn-left', 'left');
  bindButton('btn-right', 'right');
  bindButton('btn-jump', 'jump');
  if ('ontouchstart' in window) document.body.classList.add('touch');

  function anyKey(codeSet) {
    for (const code of codeSet) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** The movement input for one fixed step. */
    direction() {
      const left = anyKey(LEFT_KEYS) || touch.left;
      const right = anyKey(RIGHT_KEYS) || touch.right;
      const jump = jumpQueued || touchJumpQueued;
      const jumpHeld = anyKey(JUMP_KEYS) || touch.jump;
      jumpQueued = false;
      touchJumpQueued = false;
      return { left, right, jump, jumpHeld };
    },
    /** One-shot actions since the last call (confirm/pause/restart/mute). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
