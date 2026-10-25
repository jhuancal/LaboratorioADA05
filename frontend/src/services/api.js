/**
 * @file api.js
 * @brief Cliente HTTP modular hacia el Backend Node.js + SQLite + Motor C++20
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  getGraph: () => request('/graph'),

  calculateRoute: ({ source, target, mode, compareAllAlgorithms }) =>
    request('/route', {
      method: 'POST',
      body: JSON.stringify({ source, target, mode, compareAllAlgorithms })
    }),

  toggleEdgeClosure: (edgeId, isClosed) =>
    request(`/edges/${edgeId}/toggle-closure`, {
      method: 'POST',
      body: JSON.stringify(isClosed !== undefined ? { is_closed: isClosed } : {})
    }),

  updateNodePosition: (nodeId, payload) =>
    request(`/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  createCornerNode: (payload) =>
    request('/nodes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createStreetEdge: (payload) =>
    request('/edges', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  deleteStreetEdge: (edgeId) =>
    request(`/edges/${edgeId}`, {
      method: 'DELETE'
    }),

  deleteStreetEdgeBetween: (from, to) =>
    request(`/edges?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      method: 'DELETE'
    }),

  randomizeTraffic: (intensity = 'mixed') =>
    request('/traffic/randomize', {
      method: 'POST',
      body: JSON.stringify({ intensity })
    }),

  resetSystem: () =>
    request('/traffic/reset', {
      method: 'POST'
    }),

  runHiveMind: ({ source, target, mode, kPaths, concurrentVehicles, injectNegativeCycle }) =>
    request('/hive-mind', {
      method: 'POST',
      body: JSON.stringify({ source, target, mode, kPaths, concurrentVehicles, injectNegativeCycle })
    }),

  getRandomTour: ({ count = 5, mode = 'car', query }) =>
    request('/places/random-tour', {
      method: 'POST',
      body: JSON.stringify({ count, mode, query })
    }),

  getGoogleApiStatus: () => request('/places/status'),

  runExercise7: ({ source, target, scenario }) =>
    request('/exercises/7', {
      method: 'POST',
      body: JSON.stringify({ source, target, scenario })
    }),

  runExercise8: ({ V, density, negativeMode, hasNegativeWeights, allPairsQuery, roadClosureEvent, source, target, seed, cachedQuery }) =>
    request('/exercises/8', {
      method: 'POST',
      body: JSON.stringify({ V, density, negativeMode, hasNegativeWeights, allPairsQuery, roadClosureEvent, source, target, seed, cachedQuery })
    })
};
