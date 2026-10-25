/**
 * @file googleMapsService.js
 * @brief Integración real con Google Places API (New) v1 y Google Maps JS API
 *        usando la clave del archivo .env para descubrir lugares turísticos en Arequipa
 *        y trazar tours óptimos multi-parada con el motor C++20.
 */
import { ENV } from '../config/env.js';
import { graphRepository } from '../repositories/graphRepository.js';
import { cppEngineService } from './cppEngineService.js';

function haversineDistanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestGraphNode(lat, lng, nodes) {
  let bestNode = nodes[0];
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversineDistanceM(lat, lng, n.lat, n.lng);
    if (d < bestDist) {
      bestDist = d;
      bestNode = n;
    }
  }
  return { node: bestNode, distance_m: Math.round(bestDist) };
}

export const googleMapsService = {
  async checkApiStatus() {
    const key = ENV.GOOGLE_MAPS_API_KEY;
    const statusReport = {
      key_configured: Boolean(key),
      key_preview: key ? `${key.slice(0, 10)}...${key.slice(-4)}` : 'MISSING',
      maps_javascript_api: 'unknown',
      places_api_new_v1: 'unknown',
      discovered_places_count: 0
    };

    try {
      const jsResp = await fetch(`https://maps.googleapis.com/maps/api/js?key=${key}`);
      statusReport.maps_javascript_api = jsResp.ok ? 'ACTIVE (HTTP 200 OK)' : `HTTP ${jsResp.status}`;
    } catch (e) {
      statusReport.maps_javascript_api = `ERROR: ${e.message}`;
    }

    try {
      const placesResp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
        },
        body: JSON.stringify({ textQuery: 'lugares turisticos y puntos de interes en Arequipa Peru' })
      });
      const data = await placesResp.json();
      if (placesResp.ok && Array.isArray(data.places)) {
        statusReport.places_api_new_v1 = 'ACTIVE (HTTP 200 OK)';
        statusReport.discovered_places_count = data.places.length;
      } else {
        statusReport.places_api_new_v1 = data.error?.message || `HTTP ${placesResp.status}`;
      }
    } catch (e) {
      statusReport.places_api_new_v1 = `ERROR: ${e.message}`;
    }

    return statusReport;
  },

  async fetchArequipaPlaces(query = 'lugares turisticos miradores centros comerciales universidades en Arequipa Peru') {
    const nodes = graphRepository.getAllNodes();
    const key = ENV.GOOGLE_MAPS_API_KEY;
    let mappedPlaces = [];

    try {
      const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
        },
        body: JSON.stringify({ textQuery: query })
      });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.places)) {
        mappedPlaces = data.places
          .filter((p) => p.location?.latitude && p.location?.longitude)
          .map((p) => {
            const lat = p.location.latitude;
            const lng = p.location.longitude;
            const nearest = findNearestGraphNode(lat, lng, nodes);
            return {
              name: p.displayName?.text || 'Punto Turístico Arequipa',
              address: p.formattedAddress || 'Arequipa, Perú',
              lat,
              lng,
              mapped_node_id: nearest.node.id,
              mapped_node_name: nearest.node.name,
              distance_to_node_m: nearest.distance_m,
              source_api: 'Google Places API (New) v1 Live'
            };
          });
      }
    } catch {
      // Fallback a caché o nodos curados si no hay internet momentáneamente
    }

    // Combinar con los 24 lugares emblemáticos de Arequipa vinculados a sus esquinas más cercanas
    const curatedPlaces = graphRepository.getAllPlaces(nodes);
    const curatedLandmarks = curatedPlaces.map((p) => ({
      id: p.id,
      name: p.name,
      address: `${p.zone}, Arequipa, Perú`,
      lat: p.lat,
      lng: p.lng,
      mapped_node_id: p.nearest_node_id,
      mapped_node_name: p.nearest_node_name,
      distance_to_node_m: p.access_distance_m,
      source_api: mappedPlaces.length > 0 ? 'Google Places API (New) + Hitos Arequipa' : 'Hitos Curados de Arequipa (Vinculados a Esquina)'
    }));

    const combined = [...mappedPlaces, ...curatedLandmarks];
    if (mappedPlaces.length > 0) {
      graphRepository.savePlacesCache(mappedPlaces);
    }
    return {
      live_google_places_count: mappedPlaces.length,
      places: combined
    };
  },

  async generateRandomTour({ count = 5, mode = 'car', query = 'atracciones turisticas e historicas en Arequipa Peru' }) {
    const placesData = await this.fetchArequipaPlaces(query);
    const allCandidates = placesData.places;

    // Seleccionar K paradas con mapped_node_id únicos para que el tour recorra distintos puntos del grafo
    const byNode = new Map();
    for (const p of allCandidates) {
      if (!byNode.has(p.mapped_node_id)) {
        byNode.set(p.mapped_node_id, p);
      }
    }

    const uniqueNodePlaces = Array.from(byNode.values());
    // Mezclar aleatoriamente (Fisher-Yates)
    for (let i = uniqueNodePlaces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueNodePlaces[i], uniqueNodePlaces[j]] = [uniqueNodePlaces[j], uniqueNodePlaces[i]];
    }

    const k = Math.max(3, Math.min(8, Number(count) || 5));
    const chosenPlaces = uniqueNodePlaces.slice(0, k);
    const stopNodeIds = chosenPlaces.map((p) => p.mapped_node_id);

    const cppTour = cppEngineService.runRandomTour({
      stops: stopNodeIds,
      mode
    });

    const placeByNodeId = new Map(chosenPlaces.map((p) => [p.mapped_node_id, p]));
    const orderedPlaces = (cppTour.ordered_stops || stopNodeIds).map((nid, idx) => ({
      stop_order: idx + 1,
      node_id: nid,
      ...(placeByNodeId.get(nid) || { name: `Nodo ${nid}`, address: 'Arequipa' })
    }));

    return {
      source_api: placesData.live_google_places_count > 0 ? 'Google Places API (New) v1 Live' : 'SQLite Curated Arequipa Landmarks',
      live_google_places_fetched: placesData.live_google_places_count,
      selected_places: orderedPlaces,
      tour_result: cppTour
    };
  }
};
