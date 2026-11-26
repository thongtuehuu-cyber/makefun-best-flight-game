// The valley the mail run flies through: fields, a road, a river, a town, two
// runways and a ring of mountains. Everything is a pure function of position
// and the seed, so the same seed always builds the same valley and no map is
// stored. Nothing here touches the browser.

import { RUNWAY_END, RUNWAY_START } from './config.js';
import { cellHash } from './random.js';

/** The valley's fixed landmarks, derived from the seed at build time. */
export function createTerrain(seed) {
  const riverBase = -140;
  const riverAmp1 = 95;
  const riverAmp2 = 34;
  const roadBase = 170;
  const town = { x: 190, z: 1450, radius: 230 };
  const mountains = [];
  for (let index = 0; index < 26; index += 1) {
    const angle = -1.15 + (index / 25) * 2.3;
    const distance = 3400 + cellHash(index, 7, seed) * 1400;
    mountains.push({
      x: Math.sin(angle) * distance,
      z: Math.cos(angle) * distance + 900,
      height: 260 + cellHash(index, 11, seed) * 420,
      halfWidth: 420 + cellHash(index, 13, seed) * 520,
    });
  }
  const clouds = [];
  for (let index = 0; index < 16; index += 1) {
    clouds.push({
      x: (cellHash(index, 21, seed) - 0.5) * 3600,
      y: 260 + cellHash(index, 23, seed) * 180,
      z: 300 + cellHash(index, 29, seed) * 4200,
      scale: 90 + cellHash(index, 31, seed) * 150,
      drift: 2 + cellHash(index, 37, seed) * 4,
    });
  }
  return { seed, riverBase, riverAmp1, riverAmp2, roadBase, town, mountains, clouds };
}

/** The river's centreline at a given forward distance: two slow sines. */
export function riverXAt(terrain, z) {
  return terrain.riverBase
    + terrain.riverAmp1 * Math.sin(z * 0.0009 + 0.4)
    + terrain.riverAmp2 * Math.sin(z * 0.0021 + 1.1);
}

/** The road's centreline at a given forward distance. */
export function roadXAt(terrain, z) {
  return terrain.roadBase
    + 60 * Math.sin(z * 0.0011 + 1.7)
    + 40 * Math.sin(z * 0.00023 + 0.5);
}

function onRunway(x, z, runway) {
  return z >= runway.zMin && z <= runway.zMax && Math.abs(x - runway.x) <= runway.halfWidth;
}

/**
 * What the ground looks like at one point: 'runway', 'runway-line', 'road',
 * 'river', 'town', 'town-roof' or a field kind. The renderer asks this for
 * every patch it paints.
 */
export function groundKindAt(terrain, x, z) {
  if (onRunway(x, z, RUNWAY_START) || onRunway(x, z, RUNWAY_END)) {
    return Math.abs(x - RUNWAY_START.x) < 1.2 && ((Math.floor(z / 60) % 2) === 0) ? 'runway-line' : 'runway';
  }
  if (Math.abs(x - roadXAt(terrain, z)) < 5) return 'road';
  if (Math.abs(x - riverXAt(terrain, z)) < 13) return 'river';
  const dx = x - terrain.town.x;
  const dz = z - terrain.town.z;
  if (dx * dx + dz * dz < terrain.town.radius * terrain.town.radius) {
    return cellHash(Math.floor(x / 18), Math.floor(z / 18), terrain.seed) < 0.22 ? 'town-roof' : 'town';
  }
  const cellX = Math.floor(x / 100);
  const cellZ = Math.floor(z / 100);
  const roll = cellHash(cellX, cellZ, terrain.seed);
  if (roll < 0.14) return 'field-forest';
  if (roll < 0.38) return 'field-green';
  if (roll < 0.58) return 'field-light';
  if (roll < 0.76) return 'field-wheat';
  if (roll < 0.9) return 'field-dry';
  return 'field-green';
}
