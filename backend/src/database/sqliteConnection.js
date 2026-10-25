/**
 * @file sqliteConnection.js
 * @brief Conexión y esquema SQLite nativo (node:sqlite DatabaseSync) para persistir:
 *        1. Nodos reales de Arequipa (nodes)
 *        2. Aristas viales y tráfico superpuesto (edges)
 *        3. Matriz precalculada de Floyd-Warshall para consultas O(1) (floyd_cache)
 *        4. Caché de lugares turísticos de Google Places API (places_cache)
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ENV } from '../config/env.js';
import { INITIAL_NODES, INITIAL_EDGES } from './seedData.js';

fs.mkdirSync(path.dirname(ENV.DB_PATH), { recursive: true });
fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });

export const db = new DatabaseSync(ENV.DB_PATH);

export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      zone TEXT NOT NULL,
      category TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY,
      from_node INTEGER NOT NULL,
      to_node INTEGER NOT NULL,
      street_name TEXT NOT NULL,
      distance_m REAL NOT NULL,
      base_time_sec REAL NOT NULL,
      max_vehicles INTEGER NOT NULL,
      current_vehicles INTEGER NOT NULL,
      is_directed INTEGER NOT NULL DEFAULT 1,
      is_closed INTEGER NOT NULL DEFAULT 0,
      hive_bonus REAL NOT NULL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS floyd_cache (
      mode TEXT NOT NULL,
      u INTEGER NOT NULL,
      v INTEGER NOT NULL,
      dist REAL NOT NULL,
      next_node INTEGER NOT NULL,
      next_edge INTEGER NOT NULL,
      PRIMARY KEY (mode, u, v)
    );

    CREATE TABLE IF NOT EXISTS floyd_meta (
      mode TEXT PRIMARY KEY,
      is_valid INTEGER NOT NULL DEFAULT 1,
      computed_at TEXT NOT NULL,
      execution_time_us REAL NOT NULL DEFAULT 0.0,
      operations_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS places_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_name TEXT NOT NULL,
      formatted_address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      mapped_node_id INTEGER NOT NULL,
      source_api TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sys_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const versionRow = db.prepare("SELECT value FROM sys_meta WHERE key = 'version'").get();
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM nodes').get();
  if (!versionRow || versionRow.value !== 'v2_street_grid' || !countRow || countRow.cnt === 0) {
    reseedDatabase();
    db.prepare("INSERT INTO sys_meta (key, value) VALUES ('version', 'v2_street_grid') ON CONFLICT(key) DO UPDATE SET value = 'v2_street_grid'").run();
  }
}

export function reseedDatabase() {
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec('DELETE FROM nodes;');
    db.exec('DELETE FROM edges;');
    db.exec('DELETE FROM floyd_cache;');
    db.exec('DELETE FROM floyd_meta;');

    const insertNode = db.prepare(`
      INSERT INTO nodes (id, name, zone, category, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const n of INITIAL_NODES) {
      insertNode.run(n.id, n.name, n.zone, n.category, n.lat, n.lng);
    }

    const insertEdge = db.prepare(`
      INSERT INTO edges (id, from_node, to_node, street_name, distance_m, base_time_sec, max_vehicles, current_vehicles, is_directed, is_closed, hive_bonus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of INITIAL_EDGES) {
      insertEdge.run(
        e.id,
        e.from,
        e.to,
        e.street_name,
        e.distance_m,
        e.base_time_sec,
        e.max_vehicles,
        e.current_vehicles,
        e.is_directed ? 1 : 0,
        e.is_closed ? 1 : 0,
        e.hive_bonus || 0.0
      );
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
