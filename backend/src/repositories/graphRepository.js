/**
 * @file graphRepository.js
 * @brief Repositorio de acceso a datos SQLite para Nodos, Aristas y Caché de Floyd-Warshall
 */
import { db, reseedDatabase } from '../database/sqliteConnection.js';
import { INITIAL_PLACES } from '../database/seedData.js';

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const graphRepository = {
  getAllNodes() {
    return db.prepare('SELECT id, name, zone, category, lat, lng FROM nodes ORDER BY id ASC').all();
  },

  getAllPlaces(nodesInput = null) {
    const nodes = nodesInput || this.getAllNodes();
    if (!nodes || nodes.length === 0) return INITIAL_PLACES;

    return INITIAL_PLACES.map((p) => {
      const sorted = nodes
        .map((n) => ({
          node: n,
          distM: haversineMeters(p.lat, p.lng, n.lat, n.lng)
        }))
        .sort((a, b) => a.distM - b.distM);

      const closest = sorted[0];
      const top4 = sorted.slice(0, 4);

      return {
        ...p,
        nearest_node_id: closest.node.id,
        nearest_node_name: closest.node.name,
        nearest_node_lat: closest.node.lat,
        nearest_node_lng: closest.node.lng,
        access_distance_m: Math.round(closest.distM),
        quad_corner_ids: top4.map((item) => item.node.id),
        quad_corners: top4.map((item) => ({
          id: item.node.id,
          name: item.node.name,
          lat: item.node.lat,
          lng: item.node.lng,
          distance_m: Math.round(item.distM)
        }))
      };
    });
  },

  getAllEdges() {
    const rows = db.prepare(`
      SELECT id, from_node AS "from", to_node AS "to", street_name, distance_m, base_time_sec,
             max_vehicles, current_vehicles, is_directed, is_closed, hive_bonus
      FROM edges
      ORDER BY id ASC
    `).all();

    return rows.map((r) => {
      const occupancy = r.max_vehicles > 0 ? r.current_vehicles / r.max_vehicles : 0;
      const congestionFactor = 1.0 + 0.85 * (occupancy * occupancy);
      const effectiveTimeSec = Math.max(0.5, r.base_time_sec * congestionFactor) + r.hive_bonus;
      let congestionLevel = 'low';
      if (occupancy >= 0.85) congestionLevel = 'high';
      else if (occupancy >= 0.50) congestionLevel = 'medium';

      return {
        ...r,
        is_directed: Boolean(r.is_directed),
        is_closed: Boolean(r.is_closed),
        occupancy_ratio: Number(occupancy.toFixed(3)),
        effective_time_sec: Number(effectiveTimeSec.toFixed(2)),
        congestion_level: r.hive_bonus < 0 ? 'hive_incentive' : congestionLevel
      };
    });
  },

  toggleEdgeClosure(edgeId, forceState = undefined) {
    const row = db.prepare('SELECT id, is_closed FROM edges WHERE id = ?').get(edgeId);
    if (!row) return null;
    const nextState = forceState !== undefined ? (forceState ? 1 : 0) : (row.is_closed ? 0 : 1);
    db.prepare('UPDATE edges SET is_closed = ? WHERE id = ?').run(nextState, edgeId);
    // Invalidar la caché de Floyd-Warshall ante cualquier interferencia o cierre de vía
    db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
    return { id: edgeId, is_closed: Boolean(nextState) };
  },

  randomizeTraffic(intensity = 'mixed') {
    const edges = db.prepare('SELECT id, max_vehicles FROM edges').all();
    const updateStmt = db.prepare('UPDATE edges SET current_vehicles = ?, hive_bonus = 0 WHERE id = ?');
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const e of edges) {
        let ratio;
        if (intensity === 'rush_hour') {
          ratio = 0.55 + Math.random() * 0.60; // 55% a 115%
        } else if (intensity === 'clear' || intensity === 'light') {
          ratio = 0.10 + Math.random() * 0.15; // 10% a 25% (< 50% => 100% de rutas verdes fluidas)
        } else {
          // Mezcla realista con verdes (<50%), ámbar (50-85%) y rojos (>85%)
          const roll = Math.random();
          if (roll < 0.45) ratio = 0.15 + Math.random() * 0.32;
          else if (roll < 0.78) ratio = 0.52 + Math.random() * 0.30;
          else ratio = 0.86 + Math.random() * 0.28;
        }
        const vehicles = Math.round(e.max_vehicles * ratio);
        updateStmt.run(vehicles, e.id);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  applyHiveMindUpdates(updatedEdges) {
    const stmt = db.prepare('UPDATE edges SET current_vehicles = ?, hive_bonus = ? WHERE id = ?');
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const ue of updatedEdges) {
        stmt.run(ue.current_vehicles, ue.hive_bonus, ue.id);
      }
      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  clearHiveBonuses() {
    db.prepare('UPDATE edges SET hive_bonus = 0').run();
  },

  resetAll(preserveCustom = true) {
    if (preserveCustom) {
      // Reestablece interferencias, cierres y congestión sin eliminar nodos ni aristas personalizadas
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare('UPDATE edges SET is_closed = 0, hive_bonus = 0, current_vehicles = ROUND(max_vehicles * 0.35)').run();
        db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    } else {
      reseedDatabase();
    }
  },

  saveFloydCache(mode, pairs, metrics) {
    const delStmt = db.prepare('DELETE FROM floyd_cache WHERE mode = ?');
    const insStmt = db.prepare(`
      INSERT INTO floyd_cache (mode, u, v, dist, next_node, next_edge)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const metaStmt = db.prepare(`
      INSERT INTO floyd_meta (mode, is_valid, computed_at, execution_time_us, operations_count)
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(mode) DO UPDATE SET
        is_valid = 1,
        computed_at = excluded.computed_at,
        execution_time_us = excluded.execution_time_us,
        operations_count = excluded.operations_count
    `);

    db.exec('BEGIN TRANSACTION;');
    try {
      delStmt.run(mode);
      for (const p of pairs) {
        insStmt.run(mode, p.u, p.v, p.dist, p.next_node, p.next_edge);
      }
      metaStmt.run(
        mode,
        new Date().toISOString(),
        metrics?.execution_time_us || 0,
        metrics?.operations_count || 0
      );
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  getFloydMeta(mode = 'car') {
    return db.prepare('SELECT * FROM floyd_meta WHERE mode = ?').get(mode) || null;
  },

  lookupFloydRouteFromSqlite(mode, source, target) {
    const t0 = process.hrtime.bigint();
    const startPair = db.prepare(
      'SELECT dist, next_node, next_edge FROM floyd_cache WHERE mode = ? AND u = ? AND v = ?'
    ).get(mode, source, target);

    if (!startPair || startPair.dist < 0 || startPair.next_node === -1) {
      return null;
    }

    const pathNodes = [source];
    const pathEdges = [];
    let curr = source;
    let guard = 0;
    const stepStmt = db.prepare(
      'SELECT next_node, next_edge FROM floyd_cache WHERE mode = ? AND u = ? AND v = ?'
    );

    while (curr !== target && guard++ <= 250) {
      const step = stepStmt.get(mode, curr, target);
      if (!step || step.next_node === -1) break;
      if (step.next_edge !== -1) pathEdges.push(step.next_edge);
      pathNodes.push(step.next_node);
      curr = step.next_node;
    }
    const t1 = process.hrtime.bigint();
    const sqliteLookupNs = Number(t1 - t0);

    return {
      total_cost: startPair.dist,
      path_nodes: pathNodes,
      path_edges: pathEdges,
      sqlite_lookup_ns: sqliteLookupNs,
      sqlite_lookup_us: Number((sqliteLookupNs / 1000).toFixed(3))
    };
  },

  savePlacesCache(places) {
    const ins = db.prepare(`
      INSERT INTO places_cache (place_name, formatted_address, lat, lng, mapped_node_id, source_api, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec('DELETE FROM places_cache;');
      const now = new Date().toISOString();
      for (const p of places) {
        ins.run(p.name, p.address, p.lat, p.lng, p.mapped_node_id, p.source_api, now);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  getCachedPlaces() {
    return db.prepare('SELECT * FROM places_cache ORDER BY id ASC').all();
  },

  updateNodePosition(nodeId, { lat, lng, name }) {
    const existing = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    if (!existing) return null;

    const nextLat = Number(lat ?? existing.lat);
    const nextLng = Number(lng ?? existing.lng);
    const nextName = name !== undefined && String(name).trim() ? String(name).trim() : existing.name;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('UPDATE nodes SET lat = ?, lng = ?, name = ? WHERE id = ?').run(
        nextLat,
        nextLng,
        nextName,
        nodeId
      );

      const affectedEdges = db
        .prepare('SELECT id, from_node, to_node FROM edges WHERE from_node = ? OR to_node = ?')
        .all(nodeId, nodeId);

      const nodeStmt = db.prepare('SELECT lat, lng FROM nodes WHERE id = ?');
      const updateEdgeStmt = db.prepare(
        'UPDATE edges SET distance_m = ?, base_time_sec = ? WHERE id = ?'
      );

      for (const edge of affectedEdges) {
        const u = nodeStmt.get(edge.from_node);
        const v = nodeStmt.get(edge.to_node);
        if (u && v) {
          const distM = Math.max(15, Math.round(haversineMeters(u.lat, u.lng, v.lat, v.lng)));
          const baseTimeSec = Math.max(4, Math.round(distM / 8.0));
          updateEdgeStmt.run(distM, baseTimeSec, edge.id);
        }
      }

      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return db.prepare('SELECT id, name, zone, category, lat, lng FROM nodes WHERE id = ?').get(nodeId);
  },

  createCornerNode({
    name,
    zone = 'Centro Histórico',
    lat,
    lng,
    connectToNodeId = null,
    streetName = 'Tramo Vial Urbano',
    isDirected = false
  }) {
    const maxNodeRow = db.prepare('SELECT COALESCE(MAX(id), -1) AS maxId FROM nodes').get();
    const newId = Number(maxNodeRow?.maxId ?? -1) + 1;
    const finalName =
      name && String(name).trim() ? String(name).trim() : `Esq. Personalizada #${newId}`;
    const finalLat = Number(lat);
    const finalLng = Number(lng);

    let createdEdge = null;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        'INSERT INTO nodes (id, name, zone, category, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(newId, finalName, zone, 'intersection', finalLat, finalLng);

      if (connectToNodeId !== null && connectToNodeId !== undefined) {
        const targetNode = db
          .prepare('SELECT id, name, lat, lng FROM nodes WHERE id = ?')
          .get(Number(connectToNodeId));
        if (targetNode) {
          const maxEdgeRow = db.prepare('SELECT COALESCE(MAX(id), -1) AS maxId FROM edges').get();
          const newEdgeId = Number(maxEdgeRow?.maxId ?? -1) + 1;
          const distM = Math.max(
            15,
            Math.round(haversineMeters(targetNode.lat, targetNode.lng, finalLat, finalLng))
          );
          const baseTimeSec = Math.max(4, Math.round(distM / 8.0));

          db.prepare(`
            INSERT INTO edges (id, from_node, to_node, street_name, distance_m, base_time_sec, max_vehicles, current_vehicles, is_directed, is_closed, hive_bonus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0)
          `).run(
            newEdgeId,
            targetNode.id,
            newId,
            streetName || `Conexión hacia ${finalName}`,
            distM,
            baseTimeSec,
            70,
            20,
            isDirected ? 1 : 0
          );

          createdEdge = {
            id: newEdgeId,
            from: targetNode.id,
            to: newId,
            street_name: streetName || `Conexión hacia ${finalName}`,
            distance_m: distM,
            base_time_sec: baseTimeSec
          };
        }
      }

      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const createdNode = db
      .prepare('SELECT id, name, zone, category, lat, lng FROM nodes WHERE id = ?')
      .get(newId);
    return { node: createdNode, edge: createdEdge };
  },

  createStreetEdge({
    from,
    to,
    street_name = 'Tramo Vial Urbano',
    is_directed = false,
    max_vehicles = 70,
    current_vehicles = 20
  }) {
    const u = db.prepare('SELECT id, name, lat, lng FROM nodes WHERE id = ?').get(Number(from));
    const v = db.prepare('SELECT id, name, lat, lng FROM nodes WHERE id = ?').get(Number(to));
    if (!u || !v || u.id === v.id) {
      throw new Error('Esquinas de origen y destino inválidas para crear la vía.');
    }

    const maxEdgeRow = db.prepare('SELECT COALESCE(MAX(id), -1) AS maxId FROM edges').get();
    const newEdgeId = Number(maxEdgeRow?.maxId ?? -1) + 1;
    const distM = Math.max(15, Math.round(haversineMeters(u.lat, u.lng, v.lat, v.lng)));
    const baseTimeSec = Math.max(4, Math.round(distM / 8.0));

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO edges (id, from_node, to_node, street_name, distance_m, base_time_sec, max_vehicles, current_vehicles, is_directed, is_closed, hive_bonus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0)
      `).run(
        newEdgeId,
        u.id,
        v.id,
        street_name || 'Tramo Vial Urbano',
        distM,
        baseTimeSec,
        Number(max_vehicles) || 70,
        Number(current_vehicles) || 20,
        is_directed ? 1 : 0
      );
      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return {
      id: newEdgeId,
      from: u.id,
      to: v.id,
      street_name: street_name || 'Tramo Vial Urbano',
      distance_m: distM,
      base_time_sec: baseTimeSec,
      is_directed: Boolean(is_directed)
    };
  },

  deleteStreetEdge(edgeId) {
    const existing = db.prepare('SELECT id, from_node, to_node, street_name FROM edges WHERE id = ?').get(Number(edgeId));
    if (!existing) return null;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('DELETE FROM edges WHERE id = ?').run(Number(edgeId));
      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return existing;
  },

  deleteStreetEdgeBetween(from, to) {
    const u = Number(from);
    const v = Number(to);
    const existing = db
      .prepare('SELECT id, from_node, to_node, street_name FROM edges WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)')
      .all(u, v, v, u);

    if (!existing || existing.length === 0) return [];

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        'DELETE FROM edges WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)'
      ).run(u, v, v, u);
      db.prepare('UPDATE floyd_meta SET is_valid = 0').run();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return existing;
  }
};
