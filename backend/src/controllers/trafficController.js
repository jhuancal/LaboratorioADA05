/**
 * @file trafficController.js
 * @brief Controlador HTTP para todos los casos de uso de los Ejercicios 7, 8 y 9
 */
import { graphRepository } from '../repositories/graphRepository.js';
import { cppEngineService } from '../services/cppEngineService.js';
import { googleMapsService } from '../services/googleMapsService.js';

export const trafficController = {
  getGraphState(req, res) {
    try {
      const nodes = graphRepository.getAllNodes();
      const edges = graphRepository.getAllEdges();
      const places = graphRepository.getAllPlaces(nodes);
      const floydMetaCar = graphRepository.getFloydMeta('car');
      const closedEdges = edges.filter((e) => e.is_closed);
      const negativeEdges = edges.filter((e) => e.hive_bonus < -1e-6);

      res.json({
        nodes,
        edges,
        places,
        summary: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          total_places: places.length,
          closed_edges_count: closedEdges.length,
          negative_incentive_edges_count: negativeEdges.length,
          floyd_cache_valid: Boolean(floydMetaCar?.is_valid) && closedEdges.length === 0 && negativeEdges.length === 0,
          floyd_meta: floydMetaCar
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  calculateRoute(req, res) {
    try {
      const source = Number(req.body?.source ?? req.query?.source ?? 0);
      const target = Number(req.body?.target ?? req.query?.target ?? 1);
      const mode = String(req.body?.mode ?? req.query?.mode ?? 'car');
      const compareAllAlgorithms = Boolean(
        req.body?.compareAllAlgorithms ??
        (req.query?.compareAllAlgorithms === 'true' || req.query?.compareAllAlgorithms === '1')
      );

      const routeData = cppEngineService.calculateRoute({
        source,
        target,
        mode,
        compareAllAlgorithms
      });

      res.json(routeData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  toggleEdgeClosure(req, res) {
    try {
      const edgeId = Number(req.params.id);
      const forceState = req.body?.is_closed;
      const updated = graphRepository.toggleEdgeClosure(edgeId, forceState);
      if (!updated) {
        return res.status(404).json({ error: 'Arista no encontrada' });
      }
      const edges = graphRepository.getAllEdges();
      res.json({
        updated,
        edges,
        message: updated.is_closed
          ? 'Vía cerrada: Caché de Floyd-Warshall invalidada. El sistema conmutará automáticamente a Dijkstra O(E log V).'
          : 'Vía reabierta.'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  randomizeTraffic(req, res) {
    try {
      const intensity = req.body?.intensity || 'mixed';
      graphRepository.randomizeTraffic(intensity);
      // Al cambiar el tráfico base sin cierres ni pesos negativos, pre-calculamos Floyd-Warshall en SQLite
      const fwMetrics = cppEngineService.precomputeFloydToSqlite('car');
      const edges = graphRepository.getAllEdges();
      res.json({
        intensity,
        floyd_precomputed_metrics: fwMetrics,
        edges
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  resetSystem(req, res) {
    try {
      graphRepository.resetAll();
      const fwMetrics = cppEngineService.precomputeFloydToSqlite('car');
      const nodes = graphRepository.getAllNodes();
      const edges = graphRepository.getAllEdges();
      const places = graphRepository.getAllPlaces(nodes);
      res.json({
        message: 'Red de 127 esquinas viales y 24 lugares de Arequipa restaurada con matriz Floyd-Warshall en SQLite.',
        floyd_precomputed_metrics: fwMetrics,
        nodes,
        edges,
        places
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  updateNodePosition(req, res) {
    try {
      const nodeId = Number(req.params.id);
      const { lat, lng, name } = req.body || {};
      const node = graphRepository.updateNodePosition(nodeId, { lat, lng, name });
      if (!node) {
        return res.status(404).json({ error: 'Esquina no encontrada' });
      }
      const nodes = graphRepository.getAllNodes();
      const edges = graphRepository.getAllEdges();
      const places = graphRepository.getAllPlaces(nodes);
      res.json({
        node,
        nodes,
        edges,
        places,
        message: `📍 Esquina #${node.id} (${node.name}) reubicada y distancias viales recalculadas.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createCornerNode(req, res) {
    try {
      const { name, zone, lat, lng, connectToNodeId, streetName, isDirected } = req.body || {};
      const { node, edge } = graphRepository.createCornerNode({
        name,
        zone,
        lat,
        lng,
        connectToNodeId,
        streetName,
        isDirected
      });
      const nodes = graphRepository.getAllNodes();
      const edges = graphRepository.getAllEdges();
      const places = graphRepository.getAllPlaces(nodes);
      res.json({
        node,
        edge,
        nodes,
        edges,
        places,
        message: `➕ Nueva esquina #${node.id} (${node.name}) agregada al grafo vial.`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  createStreetEdge(req, res) {
    try {
      const { from, to, street_name, is_directed, max_vehicles, current_vehicles } = req.body || {};
      const edge = graphRepository.createStreetEdge({
        from,
        to,
        street_name,
        is_directed,
        max_vehicles,
        current_vehicles
      });
      const edges = graphRepository.getAllEdges();
      res.json({
        edge,
        edges,
        message: `🔗 Tramo vial creado entre Esquina #${edge.from} y Esquina #${edge.to} (${edge.distance_m} m).`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  deleteStreetEdge(req, res) {
    try {
      const edgeId = req.params?.id !== undefined ? Number(req.params.id) : null;
      const from = req.query?.from ?? req.body?.from;
      const to = req.query?.to ?? req.body?.to;

      if (edgeId !== null && !isNaN(edgeId)) {
        const deleted = graphRepository.deleteStreetEdge(edgeId);
        if (!deleted) {
          return res.status(404).json({ error: `Arista #${edgeId} no encontrada.` });
        }
        const edges = graphRepository.getAllEdges();
        return res.json({
          deleted,
          edges,
          message: `🗑️ Arista vial #${deleted.id} (${deleted.street_name || 'Tramo'}) eliminada correctamente.`
        });
      }

      if (from !== undefined && to !== undefined) {
        const deletedEdges = graphRepository.deleteStreetEdgeBetween(from, to);
        if (!deletedEdges || deletedEdges.length === 0) {
          return res.status(404).json({ error: `No se encontraron aristas entre la Esquina #${from} y la Esquina #${to}.` });
        }
        const edges = graphRepository.getAllEdges();
        return res.json({
          deleted: deletedEdges,
          edges,
          message: `🗑️ Se eliminaron ${deletedEdges.length} arista(s) entre la Esquina #${from} y la Esquina #${to}.`
        });
      }

      return res.status(400).json({ error: 'Se requiere ID de arista o parámetros from y to.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  runHiveMind(req, res) {
    try {
      const source = Number(req.body?.source ?? 0);
      const target = Number(req.body?.target ?? 8);
      const mode = String(req.body?.mode ?? 'car');
      const kPaths = Number(req.body?.kPaths ?? 3);
      const concurrentVehicles = Number(req.body?.concurrentVehicles ?? 80);
      const injectNegativeCycle = Boolean(req.body?.injectNegativeCycle ?? false);

      const hiveData = cppEngineService.runHiveMind({
        source,
        target,
        mode,
        kPaths,
        concurrentVehicles,
        injectNegativeCycle,
        persistChanges: true
      });

      res.json(hiveData);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getRandomTour(req, res) {
    try {
      const count = Number(req.body?.count ?? req.query?.count ?? 5);
      const mode = String(req.body?.mode ?? req.query?.mode ?? 'car');
      const query = String(
        req.body?.query ??
        req.query?.query ??
        'lugares turisticos miradores museos iglesias en Arequipa Peru'
      );
      const tour = await googleMapsService.generateRandomTour({ count, mode, query });
      res.json(tour);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getGoogleApiStatus(req, res) {
    try {
      const status = await googleMapsService.checkApiStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  runExercise7(req, res) {
    try {
      const source = Number(req.body?.source ?? req.query?.source ?? 0);
      const target = Number(req.body?.target ?? req.query?.target ?? 7);
      const scenario = String(req.body?.scenario ?? req.query?.scenario ?? 'normal');
      const data = cppEngineService.runExercise7({ source, target, scenario });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  runExercise8(req, res) {
    try {
      const V = Number(req.body?.V ?? req.query?.V ?? 24);
      const density = Number(req.body?.density ?? req.query?.density ?? 0.28);
      
      // negativeMode: 0 = none, 1 = acyclic, 2 = cycle
      let negativeMode = 0;
      const rawMode = req.body?.negativeMode ?? req.query?.negativeMode;
      if (rawMode !== undefined) {
        if (rawMode === 'cycle' || rawMode === 2 || rawMode === '2') negativeMode = 2;
        else if (rawMode === 'acyclic' || rawMode === 1 || rawMode === '1') negativeMode = 1;
        else negativeMode = 0;
      } else if (req.body?.hasNegativeWeights !== undefined || req.query?.hasNegativeWeights !== undefined) {
        const hasNeg = Boolean(req.body?.hasNegativeWeights ?? (req.query?.hasNegativeWeights === 'true'));
        negativeMode = hasNeg ? 1 : 0;
      }

      const allPairsQuery = Boolean(
        req.body?.allPairsQuery ?? (req.query?.allPairsQuery === 'true')
      );
      const roadClosureEvent = Boolean(
        req.body?.roadClosureEvent ?? (req.query?.roadClosureEvent === 'true')
      );
      const source = Number(req.body?.source ?? req.query?.source ?? 0);
      const target = Number(req.body?.target ?? req.query?.target ?? -1);
      const seed = Number(req.body?.seed ?? req.query?.seed ?? 42);
      const cachedQuery = Boolean(
        req.body?.cachedQuery ?? (req.query?.cachedQuery === 'true')
      );

      const data = cppEngineService.runExercise8({
        V,
        density,
        negativeMode,
        allPairsQuery,
        roadClosureEvent,
        source,
        target,
        seed,
        cachedQuery
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};
