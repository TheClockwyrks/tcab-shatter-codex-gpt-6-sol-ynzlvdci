import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { describe, expect, it } from "vitest";
import { FIELD_H, FIELD_W, TICK_DT } from "./constants";
import { BACKGROUND, game } from "./game";

async function setup() {
  const canvas = createCanvas(FIELD_W, FIELD_H) as unknown as HTMLCanvasElement;
  const events = new EventTarget();
  const engine = createEngine({
    canvas,
    width: FIELD_W,
    height: FIELD_H,
    background: BACKGROUND,
    game,
    surface: {
      cssWidth: () => FIELD_W,
      cssHeight: () => FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
    clock: new ConstantClock(1000 / 120),
  });
  await engine.initialize();
  return engine;
}

describe("Shatter simulation", () => {
  it("starts with a complete title state and advances fixed ticks on any screen", async () => {
    const e = await setup();
    expect(e.debug.snapshot(e.state)).toMatchObject({
      screen: "title",
      lives: 3,
      wave: 0,
      torpedoReady: true,
    });
    await e.advance(12);
    expect(e.state.simTime).toBeCloseTo(TICK_DT * 12, 8);
    expect(e.state.rocks).toHaveLength(0);
    e.destroy();
  });

  it("chips armor before a rock is destroyed and scores only on destruction", async () => {
    const e = await setup();
    e.apply((s) => e.debug.setScreen(s, "playing"));
    e.apply((s) => e.debug.setWaveSpawning(s, false));
    e.apply((s) => e.debug.setShipCollision(s, false));
    e.apply((s) => e.debug.addRock(s, "large", 300, 200));
    const id = e.state.rocks[0].id;
    for (let i = 0; i < 3; i++) {
      e.apply((s) => e.debug.addBullet(s, 300, 200, 0, 0));
      await e.advance(1);
      if (i < 2) {
        expect(e.state.rocks.find((r) => r.id === id)?.health).toBe(2 - i);
        expect(e.state.score).toBe(0);
      }
    }
    expect(e.state.rocks.find((r) => r.id === id)).toBeUndefined();
    expect(e.state.rocks.filter((r) => r.size === "medium")).toHaveLength(2);
    expect(e.state.score).toBe(20);
    e.destroy();
  });

  it("torpedo destroys armored rock outright and charge recharges", async () => {
    const e = await setup();
    e.apply((s) => e.debug.setScreen(s, "playing"));
    e.apply((s) => e.debug.setWaveSpawning(s, false));
    e.apply((s) => e.debug.setShipCollision(s, false));
    e.apply((s) => e.debug.addRock(s, "large", 300, 200));
    e.apply((s) => e.debug.addTorpedo(s, 300, 200, 0));
    e.apply((s) => e.debug.setTorpedoCharge(s, 0));
    await e.advance(1);
    expect(e.state.score).toBe(20);
    expect(e.state.torpedoes).toHaveLength(0);
    expect(e.state.torpedoCharge).toBeCloseTo(TICK_DT / 10);
    e.destroy();
  });

  it("poses and reads field values without advancing time", async () => {
    const e = await setup();
    e.apply((s) => e.debug.setShipVelocity(s, 30, 40));
    e.apply((s) => e.debug.setNextSaucerEdge(s, "right"));
    const before = e.debug.snapshot(e.state);
    e.apply((s) => e.debug.reconcile(s));
    expect(e.debug.snapshot(e.state)).toEqual(before);
    expect(before.ship.speed).toBe(50);
    expect(before.nextSaucerEdge).toBe("right");
    expect(before.simTime).toBe(0);
    e.destroy();
  });

  it("pulls a ballistic bullet while a paused field stays frozen", async () => {
    const e = await setup();
    e.apply((s) => e.debug.setScreen(s, "playing"));
    e.apply((s) => e.debug.setWaveSpawning(s, false));
    e.apply((s) => e.debug.addBullet(s, 200, 200, 0, 0));
    await e.advance(12);
    expect(e.state.bullets[0].vx).toBeGreaterThan(0);
    const x = e.state.bullets[0].x;
    e.apply((s) => e.debug.setScreen(s, "paused"));
    await e.advance(12);
    expect(e.state.bullets[0].x).toBe(x);
    expect(e.state.simTime).toBeCloseTo(24 * TICK_DT);
    e.destroy();
  });

  it("rejects a missing entity id even when the roster is empty", async () => {
    const e = await setup();
    expect(() => e.apply((s) => e.debug.removeBullet(s, 999))).toThrow(
      "Unknown id",
    );
    expect(() => e.apply((s) => e.debug.setRockHealth(s, 999, 1))).toThrow(
      "Unknown id",
    );
    expect(() =>
      e.apply((s) => e.debug.setTorpedoHoming(s, 999, false)),
    ).toThrow("Unknown id");
    e.destroy();
  });
});
