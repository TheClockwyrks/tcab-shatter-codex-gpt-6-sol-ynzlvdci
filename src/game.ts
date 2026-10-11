import type {
  Game,
  InitApi,
  UpdateApi,
  RenderApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { RockSize } from "./constants";

export const BACKGROUND = "#080e1d";
export type Screen = "title" | "howto" | "playing" | "paused" | "gameover";
export type SaucerEdge = "left" | "right";
export type FieldEdge = "top" | "bottom" | "left" | "right";
export interface ShipState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly angle: number;
  readonly thrusting: boolean;
  readonly invuln: number;
  readonly collision: boolean;
  readonly fireCooldown: number;
}
export interface BulletState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly life: number;
}
export interface RockState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly size: RockSize;
  readonly spin: number;
  readonly health: number;
  readonly flash: number;
}
export interface SaucerState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly mind: boolean;
  readonly gun: boolean;
  readonly travel: boolean;
  readonly weave: 1 | -1;
  readonly fireClock: number;
  readonly weaveClock: number;
  readonly age: number;
}
export interface TorpedoState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly heading: number;
  readonly life: number;
  readonly homing: boolean;
}
export interface ShatterState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly score: number;
  readonly lives: number;
  readonly wave: number;
  readonly waveBanner: number;
  readonly ship: ShipState;
  readonly bullets: readonly BulletState[];
  readonly rocks: readonly RockState[];
  readonly saucer: SaucerState | null;
  readonly enemyBullets: readonly BulletState[];
  readonly torpedoes: readonly TorpedoState[];
  readonly torpedoCharge: number;
  readonly waveSpawning: boolean;
  readonly saucerSpawning: boolean;
  readonly saucerClock: number;
  readonly saucerDue: number;
  readonly nextSaucerEdge: SaucerEdge | null;
  readonly nextSaucerRow: number | null;
  readonly nextSaucerAim: number | null;
  readonly nextRockSpeed: number | null;
  readonly nextRecycleEdge: FieldEdge | null;
  readonly tickClock: number;
  readonly nextId: number;
  readonly simTime: number;
  readonly muted: boolean;
  readonly trails: Readonly<
    Record<number, readonly { x: number; y: number }[]>
  >;
  readonly bonusFlash: number;
  readonly pointerDown: number | null;
}
type R = DeepReadonly<ShatterState>;
type Rect = { x: number; y: number; w: number; h: number };
const finite = (n: number): number => {
  if (!Number.isFinite(n)) throw new Error("Expected a finite number");
  return n;
};
const choice = <T extends string>(v: T, list: readonly string[]): T => {
  if (!list.includes(v)) throw new Error(`Invalid value: ${v}`);
  return v;
};
const wrap = (v: number, n: number): number => ((v % n) + n) % n;
const delta = (a: number, b: number, n: number): number =>
  wrap(b - a + n / 2, n) - n / 2;
const dv = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: delta(a.x, b.x, C.FIELD_W),
  y: delta(a.y, b.y, C.FIELD_H),
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const d = dv(a, b);
  return Math.hypot(d.x, d.y);
};
const p = (x: number, y: number) => ({
  x: wrap(x, C.FIELD_W),
  y: wrap(y, C.FIELD_H),
});
const gravity = (x: number, y: number) => {
  const dx = C.STAR_X - x,
    dy = C.STAR_Y - y,
    d = Math.hypot(dx, dy);
  const a = C.MU / Math.max(d, C.SOFTEN) ** 2;
  return d ? { x: (a * dx) / d, y: (a * dy) / d } : { x: 0, y: 0 };
};
const move = (b: BulletState, dt: number): BulletState => {
  const g = gravity(b.x, b.y);
  const vx = b.vx + g.x * dt,
    vy = b.vy + g.y * dt;
  return {
    ...b,
    ...p(b.x + vx * dt, b.y + vy * dt),
    vx,
    vy,
    life: b.life - dt,
  };
};
const baseShip = (): ShipState => ({
  x: C.SAFE_X,
  y: C.SAFE_Y,
  vx: 0,
  vy: 0,
  angle: C.FACE_UP,
  thrusting: false,
  invuln: 0,
  collision: true,
  fireCooldown: 0,
});
const initial = (muted = false): ShatterState => ({
  screen: "title",
  menuIndex: 0,
  score: 0,
  lives: C.START_LIVES,
  wave: 0,
  waveBanner: 0,
  ship: baseShip(),
  bullets: [],
  rocks: [],
  saucer: null,
  enemyBullets: [],
  torpedoes: [],
  torpedoCharge: 1,
  waveSpawning: true,
  saucerSpawning: true,
  saucerClock: 0,
  saucerDue: C.SAUCER_FIRST_DELAY,
  nextSaucerEdge: null,
  nextSaucerRow: null,
  nextSaucerAim: null,
  nextRockSpeed: null,
  nextRecycleEdge: null,
  tickClock: 0,
  nextId: 1,
  simTime: 0,
  muted,
  trails: {},
  bonusFlash: 0,
  pointerDown: null,
});
const menu = (s: R): readonly string[] =>
  s.screen === "title"
    ? C.TITLE_ITEMS
    : s.screen === "paused"
      ? C.PAUSE_ITEMS
      : s.screen === "gameover"
        ? C.GAMEOVER_ITEMS
        : [];
const menuRect = (s: R, i: number): Rect | null => {
  const items = menu(s);
  return i >= 0 && i < items.length
    ? { x: 440, y: (s.screen === "title" ? 424 : 418) + i * 62, w: 400, h: 52 }
    : null;
};
const hitMenu = (s: R, x: number, y: number) =>
  menu(s).findIndex((_, i) => {
    const r = menuRect(s, i)!;
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  });
const copy = (s: R): ShatterState => ({
  ...s,
  ship: { ...s.ship },
  bullets: s.bullets.map((b) => ({ ...b })),
  rocks: s.rocks.map((r) => ({ ...r })),
  saucer: s.saucer ? { ...s.saucer } : null,
  enemyBullets: s.enemyBullets.map((b) => ({ ...b })),
  torpedoes: s.torpedoes.map((t) => ({ ...t })),
  trails: { ...s.trails },
});
const snapshot = (s: R) => ({
  version: C.SHATTER_DEBUG_VERSION,
  screen: s.screen,
  menuIndex: s.menuIndex,
  score: s.score,
  lives: s.lives,
  wave: s.wave,
  waveBanner: s.waveBanner,
  muted: s.muted,
  waveSpawning: s.waveSpawning,
  saucerSpawning: s.saucerSpawning,
  saucerClock: s.saucerClock,
  saucerDue: s.saucerDue,
  nextSaucerEdge: s.nextSaucerEdge,
  nextSaucerRow: s.nextSaucerRow,
  nextSaucerAim: s.nextSaucerAim,
  nextRockSpeed: s.nextRockSpeed,
  nextRecycleEdge: s.nextRecycleEdge,
  ship: { ...s.ship, speed: Math.hypot(s.ship.vx, s.ship.vy) },
  bullets: s.bullets.map((b) => ({ ...b })),
  rocks: s.rocks.map((r) => ({
    id: r.id,
    x: r.x,
    y: r.y,
    vx: r.vx,
    vy: r.vy,
    size: r.size,
    radius: C.ROCK_RADIUS[r.size],
    health: r.health,
  })),
  saucer: s.saucer ? { ...s.saucer } : null,
  enemyBullets: s.enemyBullets.map((b) => ({ ...b })),
  torpedoes: s.torpedoes.map((t) => ({ ...t })),
  torpedoCharge: s.torpedoCharge,
  torpedoReady: s.torpedoCharge === 1,
  simTime: s.simTime,
});
export interface ShatterDebugApi {
  readonly version: number;
  reset(s: R): ShatterState;
  snapshot(s: R): ReturnType<typeof snapshot>;
  reconcile(s: R): ShatterState;
  menuItemRect(s: R, index: number): Rect | null;
  setScreen(s: R, v: Screen): ShatterState;
  setMenuIndex(s: R, v: number): ShatterState;
  setScore(s: R, v: number): ShatterState;
  setLives(s: R, v: number): ShatterState;
  setWave(s: R, v: number): ShatterState;
  setWaveBanner(s: R, v: number): ShatterState;
  setWaveSpawning(s: R, v: boolean): ShatterState;
  setSaucerSpawning(s: R, v: boolean): ShatterState;
  setSaucerDue(s: R, v: number): ShatterState;
  setShipPosition(s: R, x: number, y: number): ShatterState;
  setShipVelocity(s: R, vx: number, vy: number): ShatterState;
  setShipAngle(s: R, v: number): ShatterState;
  setShipInvuln(s: R, v: number): ShatterState;
  setFireCooldown(s: R, v: number): ShatterState;
  setShipCollision(s: R, v: boolean): ShatterState;
  addBullet(s: R, x: number, y: number, vx: number, vy: number): ShatterState;
  removeBullet(s: R, id: number): ShatterState;
  clearBullets(s: R): ShatterState;
  addEnemyBullet(
    s: R,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ): ShatterState;
  removeEnemyBullet(s: R, id: number): ShatterState;
  clearEnemyBullets(s: R): ShatterState;
  addRock(s: R, size: RockSize, x: number, y: number): ShatterState;
  setRockVelocity(s: R, id: number, vx: number, vy: number): ShatterState;
  setRockHealth(s: R, id: number, hp: number): ShatterState;
  removeRock(s: R, id: number): ShatterState;
  clearRocks(s: R): ShatterState;
  addSaucer(s: R, x: number, y: number): ShatterState;
  setSaucerVelocity(s: R, vx: number, vy: number): ShatterState;
  setSaucerWeave(s: R, v: 1 | -1): ShatterState;
  removeSaucer(s: R): ShatterState;
  setSaucerMind(s: R, v: boolean): ShatterState;
  setSaucerGun(s: R, v: boolean): ShatterState;
  setSaucerTravel(s: R, v: boolean): ShatterState;
  setNextSaucerEdge(s: R, v: SaucerEdge): ShatterState;
  setNextSaucerRow(s: R, v: number): ShatterState;
  setNextSaucerAim(s: R, v: number): ShatterState;
  setNextRockSpeed(s: R, v: number): ShatterState;
  setNextRecycleEdge(s: R, v: FieldEdge): ShatterState;
  setTorpedoCharge(s: R, v: number): ShatterState;
  addTorpedo(s: R, x: number, y: number, heading: number): ShatterState;
  setTorpedoHeading(s: R, id: number, v: number): ShatterState;
  setTorpedoHoming(s: R, id: number, v: boolean): ShatterState;
  removeTorpedo(s: R, id: number): ShatterState;
  clearTorpedoes(s: R): ShatterState;
}
const indexOf = (a: readonly { id: number }[], id: number) => {
  finite(id);
  const i = a.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`Unknown id: ${id}`);
  return i;
};
const removeId = <T extends { id: number }>(
  a: readonly T[],
  id: number,
): T[] => {
  const index = indexOf(a, id);
  return a.filter((_, i) => i !== index);
};
const changeId = <T extends { id: number }>(
  a: readonly T[],
  id: number,
  change: (value: T) => T,
): T[] => {
  const index = indexOf(a, id);
  return a.map((value, i) => (i === index ? change(value) : value));
};
const requireSaucer = (s: R): SaucerState => {
  if (!s.saucer) throw new Error("No saucer");
  return { ...s.saucer };
};
const gunBullet = (
  s: R,
  x: number,
  y: number,
  vx: number,
  vy: number,
  enemy = false,
): ShatterState => {
  const b = {
    id: s.nextId,
    x: finite(x),
    y: finite(y),
    vx: finite(vx),
    vy: finite(vy),
    life: enemy ? C.SAUCER_BULLET_LIFE : C.BULLET_LIFE,
  };
  return {
    ...s,
    nextId: s.nextId + 1,
    [enemy ? "enemyBullets" : "bullets"]: [
      ...(enemy ? s.enemyBullets : s.bullets),
      b,
    ],
  };
};
export const debug: ShatterDebugApi = {
  version: C.SHATTER_DEBUG_VERSION,
  reset: (s) => initial(s.muted),
  snapshot,
  reconcile: copy,
  menuItemRect: menuRect,
  setScreen: (s, v) => ({
    ...s,
    screen: choice(v, ["title", "howto", "playing", "paused", "gameover"]),
  }),
  setMenuIndex: (s, v) => ({ ...s, menuIndex: finite(v) }),
  setScore: (s, v) => ({ ...s, score: finite(v) }),
  setLives: (s, v) => ({ ...s, lives: finite(v) }),
  setWave: (s, v) => ({ ...s, wave: finite(v) }),
  setWaveBanner: (s, v) => ({ ...s, waveBanner: finite(v) }),
  setWaveSpawning: (s, v) => ({ ...s, waveSpawning: v }),
  setSaucerSpawning: (s, v) => ({ ...s, saucerSpawning: v }),
  setSaucerDue: (s, v) => ({ ...s, saucerDue: finite(v) }),
  setShipPosition: (s, x, y) => ({
    ...s,
    ship: { ...s.ship, x: finite(x), y: finite(y) },
  }),
  setShipVelocity: (s, vx, vy) => ({
    ...s,
    ship: { ...s.ship, vx: finite(vx), vy: finite(vy) },
  }),
  setShipAngle: (s, v) => ({ ...s, ship: { ...s.ship, angle: finite(v) } }),
  setShipInvuln: (s, v) => ({ ...s, ship: { ...s.ship, invuln: finite(v) } }),
  setFireCooldown: (s, v) => ({
    ...s,
    ship: { ...s.ship, fireCooldown: finite(v) },
  }),
  setShipCollision: (s, v) => ({ ...s, ship: { ...s.ship, collision: v } }),
  addBullet: (s, x, y, vx, vy) => gunBullet(s, x, y, vx, vy),
  removeBullet: (s, id) => ({
    ...s,
    bullets: removeId(s.bullets, id),
  }),
  clearBullets: (s) => ({ ...s, bullets: [] }),
  addEnemyBullet: (s, x, y, vx, vy) => gunBullet(s, x, y, vx, vy, true),
  removeEnemyBullet: (s, id) => ({
    ...s,
    enemyBullets: removeId(s.enemyBullets, id),
  }),
  clearEnemyBullets: (s) => ({ ...s, enemyBullets: [] }),
  addRock: (s, size, x, y) => ({
    ...s,
    nextId: s.nextId + 1,
    rocks: [
      ...s.rocks,
      {
        id: s.nextId,
        x: finite(x),
        y: finite(y),
        vx: 0,
        vy: 0,
        size: choice(size, ["large", "medium", "small"]),
        spin: 0,
        health: C.ROCK_HEALTH[size],
        flash: 0,
      },
    ],
  }),
  setRockVelocity: (s, id, vx, vy) => ({
    ...s,
    rocks: changeId(s.rocks, id, (r) => ({
      ...r,
      vx: finite(vx),
      vy: finite(vy),
    })),
  }),
  setRockHealth: (s, id, hp) => ({
    ...s,
    rocks: changeId(s.rocks, id, (r) => ({ ...r, health: finite(hp) })),
  }),
  removeRock: (s, id) => ({
    ...s,
    rocks: removeId(s.rocks, id),
  }),
  clearRocks: (s) => ({ ...s, rocks: [] }),
  addSaucer: (s, x, y) => ({
    ...s,
    nextId: s.nextId + 1,
    saucer: {
      id: s.nextId,
      x: finite(x),
      y: finite(y),
      vx: C.SAUCER_SPEED,
      vy: 0,
      mind: true,
      gun: true,
      travel: true,
      weave: 1,
      fireClock: C.SAUCER_FIRE_INTERVAL,
      weaveClock: C.SAUCER_WEAVE_INTERVAL,
      age: 0,
    },
  }),
  setSaucerVelocity: (s, vx, vy) => ({
    ...s,
    saucer: { ...requireSaucer(s), vx: finite(vx), vy: finite(vy) },
  }),
  setSaucerWeave: (s, v) => ({
    ...s,
    saucer: {
      ...requireSaucer(s),
      weave: v === 1 || v === -1 ? v : choice(v, ["1", "-1"]),
    },
  }),
  removeSaucer: (s) => ({ ...s, saucer: null }),
  setSaucerMind: (s, v) => ({ ...s, saucer: { ...requireSaucer(s), mind: v } }),
  setSaucerGun: (s, v) => ({ ...s, saucer: { ...requireSaucer(s), gun: v } }),
  setSaucerTravel: (s, v) => ({
    ...s,
    saucer: { ...requireSaucer(s), travel: v },
  }),
  setNextSaucerEdge: (s, v) => ({
    ...s,
    nextSaucerEdge: choice(v, ["left", "right"]),
  }),
  setNextSaucerRow: (s, v) => ({ ...s, nextSaucerRow: finite(v) }),
  setNextSaucerAim: (s, v) => ({ ...s, nextSaucerAim: finite(v) }),
  setNextRockSpeed: (s, v) => ({ ...s, nextRockSpeed: finite(v) }),
  setNextRecycleEdge: (s, v) => ({
    ...s,
    nextRecycleEdge: choice(v, ["top", "bottom", "left", "right"]),
  }),
  setTorpedoCharge: (s, v) => ({ ...s, torpedoCharge: finite(v) }),
  addTorpedo: (s, x, y, heading) => {
    finite(x);
    finite(y);
    finite(heading);
    return {
      ...s,
      nextId: s.nextId + 1,
      torpedoes: [
        ...s.torpedoes,
        {
          id: s.nextId,
          x,
          y,
          vx: Math.cos(heading) * C.TORPEDO_SPEED,
          vy: Math.sin(heading) * C.TORPEDO_SPEED,
          heading,
          life: C.TORPEDO_LIFE,
          homing: true,
        },
      ],
    };
  },
  setTorpedoHeading: (s, id, v) => ({
    ...s,
    torpedoes: changeId(s.torpedoes, id, (t) => ({
      ...t,
      heading: finite(v),
      vx: Math.cos(v) * C.TORPEDO_SPEED,
      vy: Math.sin(v) * C.TORPEDO_SPEED,
    })),
  }),
  setTorpedoHoming: (s, id, v) => ({
    ...s,
    torpedoes: changeId(s.torpedoes, id, (t) => ({ ...t, homing: v })),
  }),
  removeTorpedo: (s, id) => ({
    ...s,
    torpedoes: removeId(s.torpedoes, id),
  }),
  clearTorpedoes: (s) => ({ ...s, torpedoes: [] }),
};
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Controls = {
  left: boolean;
  right: boolean;
  up: boolean;
  fire: boolean;
  torpedo: boolean;
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const swept = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  av: { x: number; y: number },
  bv: { x: number; y: number },
  radius: number,
) => {
  const x0 = a.x - b.x,
    y0 = a.y - b.y,
    vx = av.x - bv.x,
    vy = av.y - bv.y;
  const minX = Math.ceil((-Math.max(x0, x0 + vx) - radius) / C.FIELD_W);
  const maxX = Math.floor((-Math.min(x0, x0 + vx) + radius) / C.FIELD_W);
  const minY = Math.ceil((-Math.max(y0, y0 + vy) - radius) / C.FIELD_H);
  const maxY = Math.floor((-Math.min(y0, y0 + vy) + radius) / C.FIELD_H);
  for (let ix = minX; ix <= maxX; ix++)
    for (let iy = minY; iy <= maxY; iy++) {
      const x = x0 + ix * C.FIELD_W,
        y = y0 + iy * C.FIELD_H;
      const t = Math.max(
        0,
        Math.min(1, -(x * vx + y * vy) / (vx * vx + vy * vy || 1)),
      );
      if (Math.hypot(x + vx * t, y + vy * t) <= radius) return true;
    }
  return false;
};
function placeRock(
  n: Mutable<ShatterState>,
  size: RockSize,
  edge?: FieldEdge,
): RockState {
  let x = 0,
    y = 0;
  let angle: number;
  if (edge) {
    const u = Math.random();
    if (edge === "left") {
      x = 0;
      y = u * C.FIELD_H;
      angle = rand(-Math.PI / 3, Math.PI / 3);
    } else if (edge === "right") {
      x = C.FIELD_W;
      y = u * C.FIELD_H;
      angle = rand((2 * Math.PI) / 3, (4 * Math.PI) / 3);
    } else if (edge === "top") {
      x = u * C.FIELD_W;
      y = 0;
      angle = rand(Math.PI / 6, (5 * Math.PI) / 6);
    } else {
      x = u * C.FIELD_W;
      y = C.FIELD_H;
      angle = rand((-5 * Math.PI) / 6, -Math.PI / 6);
    }
  } else {
    for (let tries = 0; tries < 2000; tries++) {
      x = rand(0, C.FIELD_W);
      y = rand(0, C.FIELD_H);
      if (
        dist({ x, y }, n.ship) >= C.WAVE_MIN_SHIP_DIST &&
        dist({ x, y }, { x: C.STAR_X, y: C.STAR_Y }) >= C.WAVE_MIN_STAR_DIST
      )
        break;
    }
    angle = rand(0, 2 * Math.PI);
  }
  const speed =
    n.nextRockSpeed ?? rand(C.ROCK_SPEED_MIN[size], C.ROCK_SPEED_MAX[size]);
  const factor = edge
    ? 1
    : 1 + Math.min(C.WAVE_SPEED_CAP, C.WAVE_SPEED_STEP * (n.wave - 1));
  return {
    id: n.nextId++,
    x,
    y,
    vx: Math.cos(angle) * speed * factor,
    vy: Math.sin(angle) * speed * factor,
    size,
    spin: rand(0, 2 * Math.PI),
    health: C.ROCK_HEALTH[size],
    flash: 0,
  };
}
function addScore(
  n: Mutable<ShatterState>,
  amount: number,
  events: Set<string>,
) {
  const old = n.score;
  n.score += amount;
  const extra =
    Math.floor(n.score / C.EXTRA_LIFE_STEP) -
    Math.floor(old / C.EXTRA_LIFE_STEP);
  if (extra > 0) {
    n.lives += extra;
    n.bonusFlash = 0.75;
    events.add(C.CUES.extraLife);
  }
}
function killRock(
  n: Mutable<ShatterState>,
  r: RockState,
  weapon: { vx: number; vy: number },
  torpedo: boolean,
  events: Set<string>,
) {
  n.rocks = n.rocks.filter((a) => a.id !== r.id);
  addScore(
    n,
    r.size === "large"
      ? C.SCORE_LARGE
      : r.size === "medium"
        ? C.SCORE_MEDIUM
        : C.SCORE_SMALL,
    events,
  );
  events.add(C.CUES.shatter);
  const child = C.ROCK_CHILD[r.size];
  if (child) {
    const length = Math.hypot(weapon.vx, weapon.vy) || 1;
    const dx = weapon.vx / length,
      dy = weapon.vy / length,
      k = torpedo ? C.TORPEDO_SCATTER : C.SPLIT_KICK;
    for (const sign of [1, -1])
      n.rocks = [
        ...n.rocks,
        {
          id: n.nextId++,
          x: r.x,
          y: r.y,
          vx: r.vx + sign * k * (torpedo ? dx : -dy),
          vy: r.vy + sign * k * (torpedo ? dy : dx),
          size: child,
          spin: r.spin,
          health: C.ROCK_HEALTH[child],
          flash: 0,
        },
      ];
  }
}
function newGame(s: R): ShatterState {
  const n = initial(s.muted) as Mutable<ShatterState>;
  n.screen = "playing";
  n.wave = 1;
  const rocks: RockState[] = [];
  for (let i = 0; i < C.WAVE_BASE_ROCKS + 1; i++)
    rocks.push(placeRock(n, "large"));
  n.rocks = rocks;
  n.nextRockSpeed = null;
  return n;
}
function tick(s: R, c: Controls, events: Set<string>): ShatterState {
  const dt = C.TICK_DT,
    n = copy(s) as Mutable<ShatterState>;
  n.simTime += dt;
  if (n.screen !== "playing") return n;
  n.bonusFlash = Math.max(0, n.bonusFlash - dt);
  n.torpedoCharge = Math.min(1, n.torpedoCharge + dt / C.TORPEDO_RECHARGE);
  let ship = { ...n.ship };
  ship.angle += (Number(c.right) - Number(c.left)) * C.SHIP_TURN * dt;
  let vx = ship.vx,
    vy = ship.vy;
  if (c.up) {
    vx += Math.cos(ship.angle) * C.SHIP_THRUST * dt;
    vy += Math.sin(ship.angle) * C.SHIP_THRUST * dt;
    events.add(C.CUES.thrust);
  }
  const drag = 0.5 ** (dt / C.SHIP_DRAG_HALFLIFE);
  vx *= drag;
  vy *= drag;
  const sp = Math.hypot(vx, vy);
  if (sp > C.SHIP_MAX) {
    vx *= C.SHIP_MAX / sp;
    vy *= C.SHIP_MAX / sp;
  }
  ship = {
    ...ship,
    ...p(ship.x + vx * dt, ship.y + vy * dt),
    vx,
    vy,
    thrusting: c.up,
    invuln: Math.max(0, ship.invuln - dt),
    fireCooldown: Math.max(0, ship.fireCooldown - 1),
  };
  const coreD = dv({ x: C.STAR_X, y: C.STAR_Y }, ship);
  const cd = Math.hypot(coreD.x, coreD.y);
  if (cd <= C.CORE_R + C.SHIP_R) {
    const nx = cd ? coreD.x / cd : 0,
      ny = cd ? coreD.y / cd : 1;
    const inward = ship.vx * nx + ship.vy * ny;
    ship = {
      ...ship,
      ...p(
        C.STAR_X + nx * (C.CORE_R + C.SHIP_R),
        C.STAR_Y + ny * (C.CORE_R + C.SHIP_R),
      ),
      vx: ship.vx - Math.min(inward, 0) * nx,
      vy: ship.vy - Math.min(inward, 0) * ny,
    };
  }
  n.ship = ship;
  if (c.fire && ship.fireCooldown === 0 && n.bullets.length < C.MAX_BULLETS) {
    const dx = Math.cos(ship.angle),
      dy = Math.sin(ship.angle);
    n.bullets = [
      ...n.bullets,
      {
        id: n.nextId++,
        x: wrap(ship.x + dx * C.SHIP_R, C.FIELD_W),
        y: wrap(ship.y + dy * C.SHIP_R, C.FIELD_H),
        vx: ship.vx + dx * C.MUZZLE_SPEED,
        vy: ship.vy + dy * C.MUZZLE_SPEED,
        life: C.BULLET_LIFE,
      },
    ];
    n.ship = { ...ship, fireCooldown: C.FIRE_INTERVAL_TICKS };
    events.add(C.CUES.fire);
  }
  if (c.torpedo && n.torpedoCharge >= 1 && n.torpedoes.length === 0) {
    const dx = Math.cos(ship.angle),
      dy = Math.sin(ship.angle);
    n.torpedoes = [
      ...n.torpedoes,
      {
        id: n.nextId++,
        x: wrap(ship.x + dx * C.SHIP_R, C.FIELD_W),
        y: wrap(ship.y + dy * C.SHIP_R, C.FIELD_H),
        vx: dx * C.TORPEDO_SPEED,
        vy: dy * C.TORPEDO_SPEED,
        heading: ship.angle,
        life: C.TORPEDO_LIFE,
        homing: true,
      },
    ];
    n.torpedoCharge = 0;
  }
  const oldBullets = n.bullets;
  const trails: Record<number, readonly { x: number; y: number }[]> = {
    ...n.trails,
  };
  n.bullets = oldBullets
    .map((b) => {
      const moved = move(b, dt);
      trails[b.id] = [
        ...(trails[b.id] ?? [{ x: b.x, y: b.y }]),
        { x: moved.x, y: moved.y },
      ].slice(-C.TRAIL_TICKS - 1);
      return moved;
    })
    .filter((b) => b.life > 0);
  n.enemyBullets = n.enemyBullets
    .map((b) => move(b, dt))
    .filter((b) => b.life > 0);
  n.rocks = n.rocks.map((r) => {
    const g = gravity(r.x, r.y),
      rvx = r.vx + g.x * dt,
      rvy = r.vy + g.y * dt;
    return {
      ...r,
      ...p(r.x + rvx * dt, r.y + rvy * dt),
      vx: rvx,
      vy: rvy,
      spin: r.spin + dt * 0.28,
      flash: Math.max(0, r.flash - dt),
    };
  });
  if (n.saucer) {
    let a = {
      ...n.saucer,
      age: n.saucer.age + dt,
      fireClock: n.saucer.fireClock - dt,
      weaveClock: n.saucer.weaveClock - dt,
    };
    if (a.age >= C.SAUCER_LIFETIME) {
      n.saucer = null;
      n.saucerClock = 0;
      n.saucerDue = rand(C.SAUCER_GAP_MIN, C.SAUCER_GAP_MAX);
    } else {
      if (a.mind && a.weaveClock <= 0) {
        a.weaveClock += C.SAUCER_WEAVE_INTERVAL;
        const dir = a.vy ? Math.sign(-a.vy) : a.weave;
        a.vy = dir * C.SAUCER_WEAVE_SPEED;
        a.weave = dir as 1 | -1;
      }
      if (a.mind) {
        const d = dv({ x: C.STAR_X, y: C.STAR_Y }, a),
          near = Math.hypot(d.x, d.y);
        if (near < 115 && a.vx * d.x + a.vy * d.y < 0) {
          a.vy = (d.y >= 0 ? 1 : -1) * C.SAUCER_WEAVE_SPEED;
        }
      }
      if (a.travel) {
        a = { ...a, ...p(a.x + a.vx * dt, a.y + a.vy * dt) };
        const d = dv({ x: C.STAR_X, y: C.STAR_Y }, a),
          len = Math.hypot(d.x, d.y);
        if (len < C.CORE_R + C.SAUCER_R) {
          a = {
            ...a,
            ...p(
              C.STAR_X + (d.x / len) * (C.CORE_R + C.SAUCER_R),
              C.STAR_Y + (d.y / len) * (C.CORE_R + C.SAUCER_R),
            ),
          };
        }
      }
      if (a.fireClock <= 0) {
        a.fireClock += C.SAUCER_FIRE_INTERVAL;
        if (a.gun) {
          const d = dv(a, n.ship),
            aim =
              Math.atan2(d.y, d.x) +
              (n.nextSaucerAim ??
                rand(-C.SAUCER_AIM_ERROR, C.SAUCER_AIM_ERROR));
          n.nextSaucerAim = null;
          n.enemyBullets = [
            ...n.enemyBullets,
            {
              id: n.nextId++,
              x: a.x,
              y: a.y,
              vx: a.vx + Math.cos(aim) * C.SAUCER_BULLET_SPEED,
              vy: a.vy + Math.sin(aim) * C.SAUCER_BULLET_SPEED,
              life: C.SAUCER_BULLET_LIFE,
            },
          ];
        }
      }
      n.saucer = a;
    }
  } else {
    n.saucerClock += dt;
    if (n.saucerSpawning && n.saucerClock >= n.saucerDue) {
      const edge = n.nextSaucerEdge ?? (Math.random() < 0.5 ? "left" : "right");
      const y = n.nextSaucerRow ?? rand(C.SAUCER_R, C.FIELD_H - C.SAUCER_R);
      n.nextSaucerEdge = null;
      n.nextSaucerRow = null;
      n.saucer = {
        id: n.nextId++,
        x: edge === "left" ? 0 : C.FIELD_W,
        y,
        vx: (edge === "left" ? 1 : -1) * C.SAUCER_SPEED,
        vy: 0,
        mind: true,
        gun: true,
        travel: true,
        weave: Math.random() < 0.5 ? 1 : -1,
        fireClock: C.SAUCER_FIRE_INTERVAL,
        weaveClock: C.SAUCER_WEAVE_INTERVAL,
        age: 0,
      };
      events.add(C.CUES.saucer);
    }
  }
  n.torpedoes = n.torpedoes
    .map((t) => {
      let h = t.heading;
      if (t.homing) {
        const candidates = [...n.rocks, ...(n.saucer ? [n.saucer] : [])]
          .map((b) => ({ b, d: dv(t, b), distance: dist(t, b) }))
          .filter(
            (o) =>
              Math.abs(
                Math.atan2(
                  Math.sin(Math.atan2(o.d.y, o.d.x) - h),
                  Math.cos(Math.atan2(o.d.y, o.d.x) - h),
                ),
              ) <= C.TORPEDO_CONE,
          )
          .sort((a, b) => a.distance - b.distance);
        if (candidates.length) {
          const d = candidates[0].d,
            target = Math.atan2(d.y, d.x),
            diff = Math.atan2(Math.sin(target - h), Math.cos(target - h));
          h += Math.max(
            -C.TORPEDO_TURN * dt,
            Math.min(C.TORPEDO_TURN * dt, diff),
          );
        }
      }
      const tvx = Math.cos(h) * C.TORPEDO_SPEED,
        tvy = Math.sin(h) * C.TORPEDO_SPEED;
      return {
        ...t,
        ...p(t.x + tvx * dt, t.y + tvy * dt),
        vx: tvx,
        vy: tvy,
        heading: h,
        life: t.life - dt,
      };
    })
    .filter((t) => t.life > 0);
  // Resolve swept contacts against the last tick's motion, including wrap seams.
  const previous = (b: { x: number; y: number; vx: number; vy: number }) => ({
    x: wrap(b.x - b.vx * dt, C.FIELD_W),
    y: wrap(b.y - b.vy * dt, C.FIELD_H),
  });
  const star = { x: C.STAR_X, y: C.STAR_Y };
  for (const b of [...n.bullets]) {
    if (!n.bullets.some((x) => x.id === b.id)) continue;
    let landed = false;
    for (const r of [...n.rocks])
      if (
        swept(
          previous(b),
          previous(r),
          { x: b.vx * dt, y: b.vy * dt },
          { x: r.vx * dt, y: r.vy * dt },
          C.BULLET_R + C.ROCK_RADIUS[r.size],
        )
      ) {
        n.bullets = n.bullets.filter((x) => x.id !== b.id);
        landed = true;
        if (r.health > 1)
          n.rocks = n.rocks.map((x) =>
            x.id === r.id
              ? { ...x, health: x.health - 1, flash: C.HIT_FLASH_TIME }
              : x,
          );
        else killRock(n, r, b, false, events);
        break;
      }
    if (
      !landed &&
      n.saucer &&
      swept(
        previous(b),
        previous(n.saucer),
        { x: b.vx * dt, y: b.vy * dt },
        { x: n.saucer.vx * dt, y: n.saucer.vy * dt },
        C.BULLET_R + C.SAUCER_R,
      )
    ) {
      n.bullets = n.bullets.filter((x) => x.id !== b.id);
      n.saucer = null;
      n.saucerClock = 0;
      n.saucerDue = rand(C.SAUCER_GAP_MIN, C.SAUCER_GAP_MAX);
      addScore(n, C.SCORE_SAUCER, events);
      landed = true;
    }
    if (
      !landed &&
      swept(
        previous(b),
        star,
        { x: b.vx * dt, y: b.vy * dt },
        { x: 0, y: 0 },
        C.BULLET_R + C.CORE_R,
      )
    )
      n.bullets = n.bullets.filter((x) => x.id !== b.id);
  }
  for (const t of [...n.torpedoes]) {
    let landed = false;
    for (const r of [...n.rocks])
      if (
        swept(
          previous(t),
          previous(r),
          { x: t.vx * dt, y: t.vy * dt },
          { x: r.vx * dt, y: r.vy * dt },
          C.TORPEDO_R + C.ROCK_RADIUS[r.size],
        )
      ) {
        n.torpedoes = n.torpedoes.filter((x) => x.id !== t.id);
        killRock(n, r, t, true, events);
        landed = true;
        break;
      }
    if (
      !landed &&
      n.saucer &&
      swept(
        previous(t),
        previous(n.saucer),
        { x: t.vx * dt, y: t.vy * dt },
        { x: n.saucer.vx * dt, y: n.saucer.vy * dt },
        C.TORPEDO_R + C.SAUCER_R,
      )
    ) {
      n.torpedoes = n.torpedoes.filter((x) => x.id !== t.id);
      n.saucer = null;
      n.saucerClock = 0;
      n.saucerDue = rand(C.SAUCER_GAP_MIN, C.SAUCER_GAP_MAX);
      addScore(n, C.SCORE_SAUCER, events);
      landed = true;
    }
    if (
      !landed &&
      swept(
        previous(t),
        star,
        { x: t.vx * dt, y: t.vy * dt },
        { x: 0, y: 0 },
        C.TORPEDO_R + C.CORE_R,
      )
    )
      n.torpedoes = n.torpedoes.filter((x) => x.id !== t.id);
  }
  for (const r of [...n.rocks])
    if (
      swept(
        previous(r),
        star,
        { x: r.vx * dt, y: r.vy * dt },
        { x: 0, y: 0 },
        C.ROCK_RADIUS[r.size] + C.CORE_R,
      )
    ) {
      const edge =
        n.nextRecycleEdge ??
        (["top", "bottom", "left", "right"] as const)[
          Math.floor(Math.random() * 4)
        ];
      const replacement = placeRock(n, r.size, edge);
      n.rocks = n.rocks.map((x) =>
        x.id === r.id ? { ...replacement, id: r.id, health: r.health } : x,
      );
      n.nextId--;
      n.nextRecycleEdge = null;
      n.nextRockSpeed = null;
    }
  n.enemyBullets = n.enemyBullets.filter(
    (b) =>
      !swept(
        previous(b),
        star,
        { x: b.vx * dt, y: b.vy * dt },
        { x: 0, y: 0 },
        C.SAUCER_BULLET_R + C.CORE_R,
      ),
  );
  if (n.ship.collision && n.ship.invuln <= 0) {
    const shipStart = previous(n.ship),
      shipTravel = { x: n.ship.vx * dt, y: n.ship.vy * dt };
    const rockHit = n.rocks.some((r) =>
      swept(
        shipStart,
        previous(r),
        shipTravel,
        { x: r.vx * dt, y: r.vy * dt },
        C.SHIP_R + C.ROCK_RADIUS[r.size],
      ),
    );
    const saucerHit =
      n.saucer &&
      swept(
        shipStart,
        previous(n.saucer),
        shipTravel,
        { x: n.saucer.vx * dt, y: n.saucer.vy * dt },
        C.SHIP_R + C.SAUCER_R,
      );
    const enemyHit = n.enemyBullets.find((b) =>
      swept(
        shipStart,
        previous(b),
        shipTravel,
        { x: b.vx * dt, y: b.vy * dt },
        C.SHIP_R + C.SAUCER_BULLET_R,
      ),
    );
    if (rockHit || saucerHit || enemyHit) {
      n.lives--;
      events.add(C.CUES.death);
      if (enemyHit)
        n.enemyBullets = n.enemyBullets.filter((b) => b.id !== enemyHit.id);
      if (n.lives > 0) n.ship = { ...baseShip(), invuln: C.INVULN_TIME };
      else n.screen = "gameover";
    }
  }
  if (n.waveBanner > 0) {
    n.waveBanner = Math.max(0, n.waveBanner - dt);
    if (n.waveBanner === 0 && n.waveSpawning) {
      const rocks: RockState[] = [];
      for (let i = 0; i < C.WAVE_BASE_ROCKS + n.wave; i++)
        rocks.push(placeRock(n, "large"));
      n.rocks = rocks;
      n.nextRockSpeed = null;
    }
  } else if (n.waveSpawning && s.rocks.length > 0 && n.rocks.length === 0) {
    n.wave++;
    n.waveBanner = C.WAVE_BANNER_TIME;
  }
  for (const id of Object.keys(trails))
    if (!n.bullets.some((b) => b.id === Number(id))) delete trails[Number(id)];
  n.trails = trails;
  return n;
}
function select(s: R): ShatterState {
  if (s.screen === "title")
    return s.menuIndex === 0 ? newGame(s) : { ...s, screen: "howto" };
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: "playing", menuIndex: 0 }
      : s.menuIndex === 1
        ? newGame(s)
        : { ...s, screen: "title", menuIndex: 0 };
  if (s.screen === "gameover")
    return s.menuIndex === 0
      ? newGame(s)
      : { ...s, screen: "title", menuIndex: 0 };
  return { ...s };
}
function readMenu(s: R, api: UpdateApi): ShatterState {
  let n: ShatterState = { ...s };
  if (
    s.screen === "paused" &&
    (api.input.pressed("pause") || api.input.pressed("back"))
  )
    return { ...s, screen: "playing", menuIndex: 0 };
  if (s.screen === "howto") {
    if (api.input.pressed("confirm") || api.input.pressed("back"))
      return { ...s, screen: "title" };
    return n;
  }
  if (s.screen === "gameover" && api.input.pressed("back"))
    return { ...s, screen: "title", menuIndex: 0 };
  const len = menu(s).length;
  if (api.input.pressed("up"))
    n = { ...n, menuIndex: wrap(n.menuIndex - 1, len) };
  if (api.input.pressed("down"))
    n = { ...n, menuIndex: wrap(n.menuIndex + 1, len) };
  const keyConfirm = api.input.pressed("confirm");
  if (keyConfirm) n = select(n);
  // Input samples preserve press and release even when both occur in one frame.
  if (!keyConfirm && menu(n).length) {
    let down = n.pointerDown;
    for (const e of api.input.pointerSamples()) {
      if (!e.primary || (e.button !== "primary" && e.type !== "move")) continue;
      const i = hitMenu(n, e.x, e.y);
      if (i >= 0) n = { ...n, menuIndex: i };
      if (e.type === "down") down = i >= 0 ? i : null;
      if (e.type === "up") {
        if (i >= 0 && i === down) {
          n = select({ ...n, menuIndex: i });
        }
        down = null;
      }
    }
    n = { ...n, pointerDown: down };
  }
  return n;
}
function drawWrapped(
  x: number,
  y: number,
  r: number,
  draw: (x: number, y: number) => void,
) {
  for (const dx of [-C.FIELD_W, 0, C.FIELD_W])
    for (const dy of [-C.FIELD_H, 0, C.FIELD_H])
      if (
        x + dx + r >= 0 &&
        x + dx - r < C.FIELD_W &&
        y + dy + r >= 0 &&
        y + dy - r < C.FIELD_H
      )
        draw(x + dx, y + dy);
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  weight = "600",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function drawShip(ctx: CanvasRenderingContext2D, s: R) {
  const a = s.ship;
  if (s.screen === "gameover") return;
  const blink = a.invuln > 0 && Math.floor(a.invuln * 8) % 2 === 0;
  drawWrapped(a.x, a.y, 25, (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a.angle);
    if (a.thrusting) {
      ctx.fillStyle = "#ff9e5b";
      ctx.beginPath();
      ctx.moveTo(-12, -6);
      ctx.lineTo(-28 - (Math.sin(s.simTime * 52) + 1) * 5, 0);
      ctx.lineTo(-12, 6);
      ctx.fill();
    }
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.strokeStyle = "#bcecff";
    ctx.fillStyle = "#15364b";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#59d7ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(19, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}
function drawRock(ctx: CanvasRenderingContext2D, r: RockState) {
  const rad = C.ROCK_RADIUS[r.size],
    damage = 1 - r.health / C.ROCK_HEALTH[r.size];
  drawWrapped(r.x, r.y, rad + 5, (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r.spin);
    ctx.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i * Math.PI * 2) / 11,
        rough = 0.84 + ((r.id * 37 + i * 19) % 13) / 55;
      const px = Math.cos(a) * rad * rough,
        py = Math.sin(a) * rad * rough;
      if (!i) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = r.flash > 0 ? "#fff4d2" : damage ? "#433944" : "#273950";
    ctx.strokeStyle = r.flash > 0 ? "#ffffff" : damage ? "#ec7b70" : "#92b7cc";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = r.flash > 0 ? "#ffdfad" : "#82c7e9";
    ctx.shadowBlur = r.flash > 0 ? 20 : 5;
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = damage ? "#f69077" : "#55768d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-rad * 0.45, -rad * 0.2);
    ctx.lineTo(0, -rad * 0.34);
    ctx.lineTo(rad * 0.2, -rad * 0.1);
    if (damage) {
      ctx.moveTo(-rad * 0.3, rad * 0.6);
      ctx.lineTo(rad * 0.05, rad * 0.1);
      ctx.lineTo(rad * 0.6, rad * 0.35);
    }
    ctx.stroke();
    ctx.restore();
  });
}
function drawField(ctx: CanvasRenderingContext2D, s: R) {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Fixed star map avoids visual randomness while the simulation remains pure.
  for (let i = 0; i < 120; i++) {
    const x = (i * 941.77) % C.FIELD_W,
      y = (i * 571.31) % C.FIELD_H;
    ctx.fillStyle = i % 8 === 0 ? "#507394" : "#243a55";
    ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  const grad = ctx.createRadialGradient(
    C.STAR_X,
    C.STAR_Y,
    C.CORE_R,
    C.STAR_X,
    C.STAR_Y,
    C.HALO_R * 1.5,
  );
  grad.addColorStop(0, "#ffd49188");
  grad.addColorStop(0.25, "#ff884c36");
  grad.addColorStop(1, "#ff673000");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(C.STAR_X, C.STAR_Y, C.HALO_R * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffad6880";
  ctx.lineWidth = 1;
  for (const rr of [62, 100, 146]) {
    ctx.beginPath();
    ctx.arc(C.STAR_X, C.STAR_Y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(
    C.STAR_X - 8,
    C.STAR_Y - 8,
    2,
    C.STAR_X,
    C.STAR_Y,
    C.CORE_R,
  );
  core.addColorStop(0, "#fffbe8");
  core.addColorStop(0.4, "#ffe1a8");
  core.addColorStop(1, "#f78752");
  ctx.fillStyle = core;
  ctx.shadowColor = "#ffb55d";
  ctx.shadowBlur = 36;
  ctx.beginPath();
  ctx.arc(C.STAR_X, C.STAR_Y, C.CORE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  for (const r of s.rocks) drawRock(ctx, r);
  for (const b of s.bullets) {
    const trail = s.trails[b.id] ?? [];
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1],
        z = trail[i];
      if (
        Math.abs(a.x - z.x) > C.FIELD_W / 2 ||
        Math.abs(a.y - z.y) > C.FIELD_H / 2
      )
        continue;
      ctx.strokeStyle = `rgba(114,225,255,${(i / trail.length) * 0.7})`;
      ctx.lineWidth = 0.5 + (i / trail.length) * 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(z.x, z.y);
      ctx.stroke();
    }
    drawWrapped(b.x, b.y, 5, (x, y) => {
      ctx.fillStyle = "#e2fbff";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  for (const b of s.enemyBullets)
    drawWrapped(b.x, b.y, 5, (x, y) => {
      ctx.fillStyle = "#ff7a9b";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  for (const t of s.torpedoes)
    drawWrapped(t.x, t.y, 12, (x, y) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.heading);
      ctx.fillStyle = "#ffde76";
      ctx.shadowColor = "#ffbb52";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-7, -5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  if (s.saucer)
    drawWrapped(s.saucer.x, s.saucer.y, 27, (x, y) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = "#ff819b";
      ctx.fillStyle = "#4b203a";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ff688b";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(0, 3, 23, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 10, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    });
  drawShip(ctx, s);
}
function drawHud(ctx: CanvasRenderingContext2D, s: R) {
  ctx.save();
  ctx.fillStyle = "#080e1ddd";
  ctx.fillRect(22, 20, 220, 166);
  text(
    ctx,
    String(s.score).padStart(6, "0"),
    36,
    67,
    36,
    "#eef8ff",
    "left",
    "700",
  );
  text(ctx, "SCORE", 38, 33, 12, "#79a5bb", "left");
  for (let i = 0; i < Math.max(0, s.lives - 1); i++) {
    ctx.save();
    ctx.translate(48 + i * 30, 99);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = "#bcecff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  text(
    ctx,
    "TORPEDO",
    38,
    135,
    12,
    s.torpedoCharge >= 1 ? "#ffe89f" : "#7f91a4",
    "left",
  );
  ctx.fillStyle = "#22394d";
  ctx.fillRect(38, 149, 160, 9);
  ctx.fillStyle = s.torpedoCharge >= 1 ? "#ffe085" : "#65c8db";
  ctx.fillRect(38, 149, 160 * s.torpedoCharge, 9);
  ctx.restore();
  if (s.waveBanner > 0) text(ctx, `WAVE ${s.wave}`, 640, 340, 54, "#f5e6bf");
  if (s.bonusFlash > 0) text(ctx, "EXTRA SHIP", 640, 420, 26, "#ffe085");
}
function panel(
  ctx: CanvasRenderingContext2D,
  s: R,
  title: string,
  subtitle = "",
) {
  ctx.fillStyle = "#080e1ddd";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  text(
    ctx,
    title,
    640,
    245,
    title === C.TITLE_TEXT ? 94 : 72,
    "#e8f7ff",
    "center",
    "800",
  );
  if (subtitle) text(ctx, subtitle, 640, 290, 18, "#83c8de");
  for (let i = 0; i < menu(s).length; i++) {
    const r = menuRect(s, i)!;
    ctx.fillStyle = i === s.menuIndex ? "#284b63" : "#102438";
    ctx.strokeStyle = i === s.menuIndex ? "#7bdfff" : "#39546a";
    ctx.lineWidth = 2;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    text(
      ctx,
      menu(s)[i],
      640,
      r.y + 35,
      23,
      i === s.menuIndex ? "#f3fcff" : "#8daebb",
    );
  }
}
function render(s: R, api: RenderApi) {
  const ctx = api.ctx;
  drawField(ctx, s);
  if (
    s.screen === "playing" ||
    s.screen === "paused" ||
    s.screen === "gameover"
  )
    drawHud(ctx, s);
  if (s.screen === "title") panel(ctx, s, C.TITLE_TEXT, C.TAGLINE_TEXT);
  if (s.screen === "paused") panel(ctx, s, "PAUSED");
  if (s.screen === "gameover")
    panel(ctx, s, "GAME OVER", `SCORE ${s.score}  •  WAVE ${s.wave}`);
  if (s.screen === "howto") {
    ctx.fillStyle = "#080e1df0";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    text(ctx, "HOW TO PLAY", 640, 104, 54, "#e8f7ff");
    const lines = [
      "Clear every rock and its fragments to reach the next wave.",
      "ARROWS or WASD turn and thrust. SPACE fires.",
      "Large rocks wear armor; their cracks show the damage.",
      "The star bends bullets and rocks, but never your ship.",
      "Rocks swallowed by the star return from the field edge.",
      "F launches one guided torpedo every ten seconds.",
      "It homes onto the nearest target in a narrow forward cone,",
      "flies true through the well, and destroys any rock outright.",
      "Shoot down the hunting saucer when it arrives.",
      "ENTER or ESC returns. P pauses. M mutes.",
    ];
    lines.forEach((line, i) =>
      text(ctx, line, 640, 176 + i * 44, 22, i === 5 ? "#ffdf91" : "#b8d4e2"),
    );
  }
}
export const game: Game<ShatterState, ShatterDebugApi> = {
  initialize(api: InitApi<ShatterState>) {
    for (const action of C.ACTIONS)
      api.input.register(action, C.BINDINGS[action]);
    const sounds = [
      { name: C.CUES.fire, freq: 730, to: 250, duration: 90 },
      { name: C.CUES.shatter, freq: 140, to: 45, duration: 250 },
      { name: C.CUES.thrust, freq: 68, to: 68, duration: 100 },
      { name: C.CUES.saucer, freq: 400, to: 210, duration: 250 },
      { name: C.CUES.death, freq: 280, to: 40, duration: 500 },
      { name: C.CUES.extraLife, freq: 620, to: 1000, duration: 500 },
    ];
    for (const cue of sounds)
      api.audio.define(cue.name, {
        wave: cue.name === C.CUES.thrust ? "sawtooth" : "triangle",
        freq: cue.freq,
        freqTo: cue.to,
        durationMs: cue.duration,
        gain: cue.name === C.CUES.thrust ? 0.04 : 0.14,
      });
    const ds: [string, (s: R) => string | number | boolean][] = [
      ["screen", (s) => s.screen],
      ["score", (s) => s.score],
      ["lives", (s) => s.lives],
      ["wave", (s) => s.wave],
      ["ship pos", (s) => `${s.ship.x.toFixed(1)}, ${s.ship.y.toFixed(1)}`],
      ["ship vel", (s) => `${s.ship.vx.toFixed(1)}, ${s.ship.vy.toFixed(1)}`],
      ["ship speed", (s) => Math.hypot(s.ship.vx, s.ship.vy)],
      ["ship angle", (s) => s.ship.angle],
      ["invuln", (s) => s.ship.invuln],
      ["bullets", (s) => s.bullets.length],
      ["rocks", (s) => s.rocks.length],
      ["saucer", (s) => !!s.saucer],
      [
        "saucer pos",
        (s) =>
          s.saucer
            ? `${s.saucer.x.toFixed(1)}, ${s.saucer.y.toFixed(1)}`
            : "none",
      ],
      ["torpedo charge", (s) => s.torpedoCharge],
      ["torpedoes", (s) => s.torpedoes.length],
      ["sim time", (s) => s.simTime],
    ];
    for (const [name, fn] of ds) api.diagnostics.register(name, fn);
    return [initial(), debug];
  },
  update(s: R, api: UpdateApi, dt: number) {
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    let n: ShatterState = { ...s, muted: api.audio.muted() };
    const torpedo = api.input.pressed("b");
    if (n.screen === "playing") {
      if (api.input.pressed("pause"))
        n = { ...n, screen: "paused", menuIndex: 0 };
    } else n = readMenu(n, api);
    const c: Controls = {
      left: api.input.value("left") > 0,
      right: api.input.value("right") > 0,
      up: api.input.value("up") > 0,
      fire: api.input.value("a") > 0,
      torpedo,
    };
    const events = new Set<string>();
    let clock = n.tickClock + Math.max(0, dt);
    while (clock + 1e-10 >= C.TICK_DT) {
      n = tick(n, c, events);
      clock -= C.TICK_DT;
    }
    n = { ...n, tickClock: clock };
    for (const cue of events) if (cue !== C.CUES.thrust) api.audio.play(cue);
    if (n.screen === "playing" && n.ship.thrusting)
      api.audio.loop(C.CUES.thrust);
    else api.audio.stop(C.CUES.thrust);
    return n;
  },
  render,
};
