import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api.js';
import Exercise7Tab from './components/Exercise7Tab.jsx';
import Exercise8Tab from './components/Exercise8Tab.jsx';
import Exercise9View from './components/Exercise9View.jsx';

export default function App() {
  const [mapOverlayMode, setMapOverlayMode] = useState('hive'); // 'hive' (solo colmena) | 'individual' (solo individual) | 'both'
  const [compareAllAlgorithms, setCompareAllAlgorithms] = useState(true);
  const [transportMode, setTransportMode] = useState('car');
  const [mapViewMode, setMapViewMode] = useState('google');
  const [selectionClickMode, setSelectionClickMode] = useState('source');

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [places, setPlaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [googleApiStatus, setGoogleApiStatus] = useState(null);

  const [source, setSource] = useState(39); // Esq. C. La Merced con C. San Agustín (junto a Plaza de Armas)
  const [target, setTarget] = useState(52); // Esq. C. Colón / Pizarro con C. Deán Valdivia (junto a Mercado San Camilo)
  const [routeResponse, setRouteResponse] = useState(null);
  const [inspectedAlgoId, setInspectedAlgoId] = useState(null);
  const [showMstOverlay, setShowMstOverlay] = useState(false);

  const [hiveResult, setHiveResult] = useState(null);
  const [tourResult, setTourResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusToast, setStatusToast] = useState(null);

  const showToast = (msg) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 4500);
  };

  const fetchGraphAndRoute = useCallback(
    async (s = source, t = target, m = transportMode, cmp = compareAllAlgorithms) => {
      setLoading(true);
      try {
        const [graphData, routeData, hiveData] = await Promise.all([
          api.getGraph(),
          api.calculateRoute({
            source: s,
            target: t,
            mode: m,
            compareAllAlgorithms: cmp
          }),
          api.runHiveMind({
            source: s,
            target: t,
            mode: m,
            kPaths: 3,
            concurrentVehicles: 75,
            injectNegativeCycle: false
          }).catch(() => null)
        ]);
        setNodes(graphData.nodes || []);
        setEdges(graphData.edges || []);
        setPlaces(graphData.places || []);
        setSummary(graphData.summary || null);
        setRouteResponse(routeData);
        setInspectedAlgoId(routeData.selected_algorithm_id);
        if (hiveData) {
          setHiveResult(hiveData);
        }
      } catch (err) {
        showToast(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [source, target, transportMode, compareAllAlgorithms]
  );

  useEffect(() => {
    fetchGraphAndRoute(source, target, transportMode, compareAllAlgorithms);
  }, [source, target, transportMode, compareAllAlgorithms, fetchGraphAndRoute]);

  useEffect(() => {
    api
      .getGoogleApiStatus()
      .then(setGoogleApiStatus)
      .catch(() => {});
  }, []);

  const handleToggleEdgeClosure = async (edgeId) => {
    try {
      const res = await api.toggleEdgeClosure(edgeId);
      setTourResult(null);
      showToast(res.message);
      await fetchGraphAndRoute(source, target, transportMode, compareAllAlgorithms);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleRandomizeTraffic = async (intensity = 'mixed') => {
    setLoading(true);
    try {
      await api.randomizeTraffic(intensity);
      setHiveResult(null);
      setTourResult(null);
      showToast(
        intensity === 'rush_hour'
          ? '🚦 Tráfico de Hora Punta generado y Matriz Floyd-Warshall actualizada en SQLite.'
          : intensity === 'clear'
            ? '🟢 Tráfico despejado: todas las rutas urbanas en verde fluido (< 50% de capacidad).'
            : '🎲 Tráfico vehicular aleatorio generado en las vías de Arequipa.'
      );
      await fetchGraphAndRoute(source, target, transportMode, compareAllAlgorithms);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = async () => {
    setLoading(true);
    try {
      const res = await api.resetSystem();
      setHiveResult(null);
      setTourResult(null);
      showToast(res.message);
      await fetchGraphAndRoute(source, target, transportMode, compareAllAlgorithms);
    } finally {
      setLoading(false);
    }
  };

  const handleRunHiveMind = async ({
    source: s,
    target: t,
    kPaths,
    concurrentVehicles,
    injectNegativeCycle
  }) => {
    setLoading(true);
    try {
      const res = await api.runHiveMind({
        source: s,
        target: t,
        mode: transportMode,
        kPaths,
        concurrentVehicles,
        injectNegativeCycle
      });
      setHiveResult(res);
      setTourResult(null);
      await fetchGraphAndRoute(s, t, transportMode, compareAllAlgorithms);
      showToast(
        injectNegativeCycle
          ? '⚠️ Ciclo de Peso Negativo inyectado y detectado en la V-ésima iteración de Bellman-Ford.'
          : `🧠 Mente Colmena activa: ${concurrentVehicles} vehículos distribuidos en ${kPaths} rutas con bonos negativos Bellman-Ford.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRandomTour = async () => {
    setLoading(true);
    try {
      const res = await api.getRandomTour({ count: 5, mode: transportMode });
      setTourResult(res);
      setHiveResult(null);
      showToast(
        `🌍 Tour Turístico creado con ${res.selected_places?.length || 5} lugares reales vía ${res.source_api}.`
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-ejecutar Mente Colmena al cargar los nodos para tener la flota lista
  useEffect(() => {
    if (!hiveResult && nodes.length > 0) {
      handleRunHiveMind({
        source,
        target,
        kPaths: 3,
        concurrentVehicles: 85,
        injectNegativeCycle: false
      });
    }
  }, [nodes.length]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Toast Notification */}
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl border border-indigo-500/50 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-indigo-200 shadow-2xl backdrop-blur">
          {statusToast}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/ejercicio09" replace />} />
          <Route path="/ejercicio07" element={<Exercise7Tab />} />
          <Route path="/ejercicio08" element={<Exercise8Tab />} />
          <Route
            path="/ejercicio09"
            element={
              <Exercise9View
                nodes={nodes}
                edges={edges}
                places={places}
                summary={summary}
                googleApiStatus={googleApiStatus}
                source={source}
                target={target}
                onSelectSource={setSource}
                onSelectTarget={setTarget}
                onGraphMutated={fetchGraphAndRoute}
                showToast={showToast}
                transportMode={transportMode}
                setTransportMode={setTransportMode}
                mapOverlayMode={mapOverlayMode}
                setMapOverlayMode={setMapOverlayMode}
                mapViewMode={mapViewMode}
                setMapViewMode={setMapViewMode}
                selectionClickMode={selectionClickMode}
                setSelectionClickMode={setSelectionClickMode}
                compareAllAlgorithms={compareAllAlgorithms}
                setCompareAllAlgorithms={setCompareAllAlgorithms}
                routeResponse={routeResponse}
                inspectedAlgoId={inspectedAlgoId}
                setInspectedAlgoId={setInspectedAlgoId}
                showMstOverlay={showMstOverlay}
                setShowMstOverlay={setShowMstOverlay}
                hiveResult={hiveResult}
                tourResult={tourResult}
                setTourResult={setTourResult}
                loading={loading}
                handleToggleEdgeClosure={handleToggleEdgeClosure}
                handleRandomizeTraffic={handleRandomizeTraffic}
                handleResetSystem={handleResetSystem}
                handleRunHiveMind={handleRunHiveMind}
                handleRandomTour={handleRandomTour}
              />
            }
          />
          <Route path="*" element={<Navigate to="/ejercicio09" replace />} />
        </Routes>
      </main>
    </div>
  );
}
