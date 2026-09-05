import { EMPTY_INPUT, type InputState, type Side } from './types';

type Key = keyof InputState;

const P1_KEYS: Record<string, Key> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyF: 'light',
  KeyG: 'heavy',
  KeyH: 'special',
  Space: 'super',
};

const P2_KEYS: Record<string, Key> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyK: 'light',
  KeyL: 'heavy',
  Semicolon: 'special',
  Enter: 'super',
  Numpad1: 'light',
  Numpad2: 'heavy',
  Numpad3: 'special',
  Numpad0: 'super',
};

const BUTTONS: Key[] = ['light', 'heavy', 'special', 'super'];

export class InputManager {
  private held: [Set<Key>, Set<Key>] = [new Set(), new Set()];
  private pressed: [Set<Key>, Set<Key>] = [new Set(), new Set()];
  enabled = true;

  private onDown = (e: KeyboardEvent) => {
    const maps: [Record<string, Key>, Record<string, Key>] = [P1_KEYS, P2_KEYS];
    let handled = false;
    maps.forEach((m, i) => {
      const k = m[e.code];
      if (!k) return;
      handled = true;
      if (!this.enabled) return;
      if (!e.repeat) {
        this.held[i].add(k);
        this.pressed[i].add(k);
      }
    });
    if (handled && this.enabled) e.preventDefault();
  };

  private onUp = (e: KeyboardEvent) => {
    const maps: [Record<string, Key>, Record<string, Key>] = [P1_KEYS, P2_KEYS];
    maps.forEach((m, i) => {
      const k = m[e.code];
      if (k) this.held[i].delete(k);
    });
  };

  private onBlur = () => this.reset();

  attach() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  /** タッチ操作用 */
  touch(side: Side, key: Key, down: boolean) {
    if (down) {
      if (!this.held[side].has(key)) this.pressed[side].add(key);
      this.held[side].add(key);
    } else {
      this.held[side].delete(key);
    }
  }

  /** 方向キーの一括更新（スライド操作・仮想D-pad用） */
  setDirections(side: Side, dirs: Partial<Record<'left' | 'right' | 'up' | 'down', boolean>>) {
    const dirKeys: ('left' | 'right' | 'up' | 'down')[] = ['left', 'right', 'up', 'down'];
    for (const k of dirKeys) {
      if (dirs[k]) {
        this.held[side].add(k);
      } else {
        this.held[side].delete(k);
      }
    }
  }

  poll(side: Side): InputState {
    const s: InputState = { ...EMPTY_INPUT };
    for (const k of this.held[side]) if (!BUTTONS.includes(k)) s[k] = true;
    for (const k of this.pressed[side]) s[k] = true;
    this.pressed[side].clear();
    return s;
  }

  reset() {
    this.held[0].clear();
    this.held[1].clear();
    this.pressed[0].clear();
    this.pressed[1].clear();
  }
}
