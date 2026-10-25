import React, { useState, useEffect } from 'react';
import ArequipaMapView from './ArequipaMapView.jsx';
import TelemetryPanel from './TelemetryPanel.jsx';
import HiveMindPanel from './HiveMindPanel.jsx';
import {
  Settings,
  X,
  Navigation,
  ArrowLeftRight,
  Car,
  Footprints,
  Shuffle,
  RotateCcw,
  Compass,
  Ban,
  Sparkles,
  Users,
  Zap,
  BarChart3,
  Layers,
  MapPin,
  CheckCircle2,
  SlidersHorizontal,
  Eye,
  AlertTriangle,
  Globe,
  Play,
  Pause,
  Crosshair
} from 'lucide-react';

export default function Exercise9View({
  nodes,
  edges,
  places = [],
  summary,
  googleApiStatus,
  source,
  target,
  onSelectSource,
  onSelectTarget,
  onGraphMutated,
  showToast,
  transportMode,
  setTransportMode,
  mapOverlayMode,
  setMapOverlayMode,
  mapViewMode,
  setMapViewMode,
  selectionClickMode,
  setSelectionClickMode,
  compareAllAlgorithms,
  setCompareAllAlgorithms,
  routeResponse,
  inspectedAlgoId,
  setInspectedAlgoId,
  showMstOverlay,
  setShowMstOverlay,
  hiveResult,
  tourResult,
  setTourResult,
  loading,
  handleToggleEdgeClosure,
  handleRandomizeTraffic,
  handleResetSystem,
  handleRunHiveMind,
  handleRandomTour
}) {
  // Estado del Menú Lateral Desplegable (Drawer)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('tools'); // 'tools' | 'hive' | 'closures' | 'views'

  // Controles de visibilidad en la pantalla principal
  const [showRouteCard, setShowRouteCard] = useState(true);
  const [showSimWidget, setShowSimWidget] = useState(false);
  const [showHiveDetails, setShowHiveDetails] = useState(false);
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);

  // Separación Lugar (24 hitos) ↔ Esquina Vial (127 intersecciones)
  const [sourcePlaceId, setSourcePlaceId] = useState(0); // Plaza de Armas
  const [targetPlaceId, setTargetPlaceId] = useState(1); // Mercado San Camilo
  const [placeLinkMode, setPlaceLinkMode] = useState('nearest'); // 'nearest' (1 esquina) | 'quad' (4 esquinas de la cuadra)
  const [showAllPlaces, setShowAllPlaces] = useState(true);

  // Estado del Simulador de Reducción de Tráfico y Despacho de Flota
  const [fleetSimulation, setFleetSimulation] = useState({
    running: false,
    paused: false,
    strategy: 'hive', // 'hive' | 'selfish'
    fleetSize: 5, // 5 | 15 | 45 | 90
    progress: 0,
    speed: 1
  });

  // Bucle de animación de la simulación de despacho de flota
  useEffect(() => {
    if (!fleetSimulation.running || fleetSimulation.paused) return;

    const intervalMs = 40;
    const step = 0.005 * fleetSimulation.speed;

    const timer = setInterval(() => {
      setFleetSimulation((prev) => {
        if (!prev.running || prev.paused) return prev;
        const nextP = prev.progress + step;
        if (nextP >= 1) {
          return {
            ...prev,
            progress: 1,
            running: false,
            paused: false
          };
        }
        return {
          ...prev,
          progress: nextP
        };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fleetSimulation.running, fleetSimulation.paused, fleetSimulation.speed]);

  const closedEdgesList = edges.filter((e) => e.is_closed);
  const negativeEdgesList = edges.filter((e) => e.hive_bonus < -0.01);

  const activeMetrics =
    (inspectedAlgoId && routeResponse?.all_algorithms?.[inspectedAlgoId]) ||
    routeResponse?.primary_result;

  const hasHiveRoutes = Boolean(hiveResult?.k_routes && hiveResult.k_routes.length > 0);

  // En el Ejercicio 09, el protagonismo es exclusivo de la Mente Colmena: si existen rutas de colmena,
  // NO se muestra la ruta individual de Dijkstra (evita pintar 2 caminos simultáneos).
  const activeRouteEdges =
    (hasHiveRoutes && mapOverlayMode !== 'individual') || mapOverlayMode === 'hive'
      ? []
      : tourResult?.tour_result?.tour_edges || activeMetrics?.path_edges || [];

  const activeRouteNodes =
    (hasHiveRoutes && mapOverlayMode !== 'individual') || mapOverlayMode === 'hive'
      ? []
      : tourResult?.tour_result?.tour_nodes || activeMetrics?.path_nodes || [];
  const mstEdges =
    tourResult?.tour_result?.mst_backbone_edges ||
    routeResponse?.mst_backbone_edges ||
    [];
  const negativeCycleNodes =
    hiveResult?.bellman_ford_hive?.negative_cycle_nodes ||
    activeMetrics?.negative_cycle_nodes ||
    [];
  const activeHiveRoutes =
    mapOverlayMode === 'individual' ? [] : hiveResult?.k_routes || [];

  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);
  const sourcePlace =
    sourcePlaceId !== null ? places.find((p) => p.id === sourcePlaceId) || null : null;
  const targetPlace =
    targetPlaceId !== null ? places.find((p) => p.id === targetPlaceId) || null : null;

  const handleSelectPlace = (placeId, role = 'source') => {
    const p = places.find((item) => item.id === Number(placeId));
    if (!p) return;
    setTourResult(null);
    if (role === 'source') {
      setSourcePlaceId(p.id);
      onSelectSource(p.nearest_node_id);
    } else {
      setTargetPlaceId(p.id);
      onSelectTarget(p.nearest_node_id);
    }
  };

  const handleSelectCorner = (nodeId, role = 'source') => {
    const nid = Number(nodeId);
    setTourResult(null);
    if (role === 'source') {
      const matchingPlace = places.find((p) => p.nearest_node_id === nid);
      setSourcePlaceId(matchingPlace ? matchingPlace.id : null);
      onSelectSource(nid);
    } else {
      const matchingPlace = places.find((p) => p.nearest_node_id === nid);
      setTargetPlaceId(matchingPlace ? matchingPlace.id : null);
      onSelectTarget(nid);
    }
  };

  const extraAccessMeters =
    (sourcePlace ? sourcePlace.access_distance_m || 0 : 0) +
    (targetPlace ? targetPlace.access_distance_m || 0 : 0);

  const totalDistKm = activeMetrics?.total_distance_m
    ? (activeMetrics.total_distance_m / 1000).toFixed(2)
    : '0.00';
  const totalTimeMin = activeMetrics?.total_cost
    ? (activeMetrics.total_cost / 60).toFixed(1)
    : '0.0';

  return (
    <div className="relative space-y-4">
      {/* ============================================================ */}
      {/* BARRA FLOTANTE / CABECERA COMPACTA DE CONTROL SUPERIOR */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl backdrop-blur flex flex-wrap items-center justify-between gap-3">
        {/* Lado Izquierdo: Botón de Configuración y Título Compacto */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg cursor-pointer transition select-none"
            title="Abrir menú de configuración, simulación de tráfico y herramientas avanzadas"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Configuración &amp; Herramientas</span>
            {closedEdgesList.length > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {closedEdgesList.length}
              </span>
            )}
          </button>

          <div className="hidden md:block">
            <span className="font-bold text-sm text-white flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-cyan-400" />
              Rutas Inteligentes Arequipa
            </span>
          </div>
        </div>

        {/* Centro: Selector de Origen y Destino Rápido (Lugares vs Esquinas Viales) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Origen */}
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-slate-950/80 px-2.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-emerald-400">Origen:</span>
            <select
              value={sourcePlace ? `place:${sourcePlace.id}` : `node:${source}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('place:')) {
                  handleSelectPlace(Number(val.replace('place:', '')), 'source');
                } else {
                  handleSelectCorner(Number(val.replace('node:', '')), 'source');
                }
              }}
              className="bg-transparent font-medium text-white outline-none cursor-pointer text-xs max-w-[235px] truncate"
            >
              <optgroup
                label={`📍 ${places.length} Lugares / Hitos (Vinculados a Esquina Vial)`}
                className="bg-slate-950 text-amber-300 font-bold"
              >
                {places.map((p) => (
                  <option
                    key={`src-place-${p.id}`}
                    value={`place:${p.id}`}
                    className="bg-slate-900 text-white font-normal"
                  >
                    📍 {p.name} (⇢ Esq. #{p.nearest_node_id} a +{p.access_distance_m}m)
                  </option>
                ))}
              </optgroup>
              <optgroup
                label={`⚪ ${nodes.length} Esquinas e Intersecciones Viales`}
                className="bg-slate-950 text-cyan-300 font-bold"
              >
                {nodes.map((n) => (
                  <option
                    key={`src-node-${n.id}`}
                    value={`node:${n.id}`}
                    className="bg-slate-900 text-slate-200 font-normal"
                  >
                    [Esq. #{n.id}] {n.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Botón Invertir */}
          <button
            type="button"
            onClick={() => {
              const prevS = source;
              const prevSP = sourcePlaceId;
              onSelectSource(target);
              onSelectTarget(prevS);
              setSourcePlaceId(targetPlaceId);
              setTargetPlaceId(prevSP);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition"
            title="Invertir Origen y Destino"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>

          {/* Destino */}
          <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-slate-950/80 px-2.5 py-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="font-semibold text-rose-400">Destino:</span>
            <select
              value={targetPlace ? `place:${targetPlace.id}` : `node:${target}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('place:')) {
                  handleSelectPlace(Number(val.replace('place:', '')), 'target');
                } else {
                  handleSelectCorner(Number(val.replace('node:', '')), 'target');
                }
              }}
              className="bg-transparent font-medium text-white outline-none cursor-pointer text-xs max-w-[235px] truncate"
            >
              <optgroup
                label={`📍 ${places.length} Lugares / Hitos (Vinculados a Esquina Vial)`}
                className="bg-slate-950 text-amber-300 font-bold"
              >
                {places.map((p) => (
                  <option
                    key={`dst-place-${p.id}`}
                    value={`place:${p.id}`}
                    className="bg-slate-900 text-white font-normal"
                  >
                    📍 {p.name} (⇢ Esq. #{p.nearest_node_id} a +{p.access_distance_m}m)
                  </option>
                ))}
              </optgroup>
              <optgroup
                label={`⚪ ${nodes.length} Esquinas e Intersecciones Viales`}
                className="bg-slate-950 text-cyan-300 font-bold"
              >
                {nodes.map((n) => (
                  <option
                    key={`dst-node-${n.id}`}
                    value={`node:${n.id}`}
                    className="bg-slate-900 text-slate-200 font-normal"
                  >
                    [Esq. #{n.id}] {n.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Lado Derecho: Acceso Rápido a Despacho de Flota en Vivo */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSimWidget(!showSimWidget)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              showSimWidget || fleetSimulation.running
                ? 'border-indigo-500/60 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-950/40'
                : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
            title="Abrir panel de despacho de flota en vivo (Simulación de Reducción de Tráfico con Mente Colmena)"
          >
            <Car className="h-3.5 w-3.5 text-cyan-400" />
            <span>{showSimWidget ? 'Ocultar Despacho' : '🚗 Despacho de Flota'}</span>
            {fleetSimulation.running && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Franja de Vínculo Punteado Lugar ↔ Esquina Vial */}
        <div className="w-full border-t border-slate-800/80 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-emerald-300">
              {sourcePlace ? (
                <>
                  📍 <strong>{sourcePlace.name}</strong> ⇢ ⚪{' '}
                  <span className="text-slate-200">
                    Esq. #{source} ({sourceNode?.name || 'Esquina'})
                  </span>{' '}
                  <span className="font-mono text-emerald-400">
                    (+{sourcePlace.access_distance_m} m línea punteada)
                  </span>
                </>
              ) : (
                <>
                  ⚪ <strong>Esquina de Partida #{source}:</strong> {sourceNode?.name || `V${source}`}{' '}
                  <span className="font-mono text-slate-400">(+0 m directo en esquina)</span>
                </>
              )}
            </span>

            <span className="text-slate-500 font-bold">➔</span>

            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-950/30 px-2 py-0.5 text-rose-300">
              {targetPlace ? (
                <>
                  📍 <strong>{targetPlace.name}</strong> ⇢ ⚪{' '}
                  <span className="text-slate-200">
                    Esq. #{target} ({targetNode?.name || 'Esquina'})
                  </span>{' '}
                  <span className="font-mono text-rose-400">
                    (+{targetPlace.access_distance_m} m línea punteada)
                  </span>
                </>
              ) : (
                <>
                  ⚪ <strong>Esquina de Llegada #{target}:</strong> {targetNode?.name || `V${target}`}{' '}
                  <span className="font-mono text-slate-400">(+0 m directo en esquina)</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setPlaceLinkMode((prev) => (prev === 'nearest' ? 'quad' : 'nearest'))
              }
              className={`rounded-lg border px-2 py-0.5 font-semibold transition cursor-pointer ${
                placeLinkMode === 'quad'
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
              title="Alternar entre conectar el lugar a 1 esquina más cercana o a las 4 esquinas de su cuadra"
            >
              {placeLinkMode === 'nearest'
                ? '📐 Vínculo Punteado: 1 Esquina Más Cercana'
                : '📐 Vínculo Punteado: 4 Esquinas de la Cuadra'}
            </button>
            <button
              type="button"
              onClick={() => setShowAllPlaces((prev) => !prev)}
              className={`rounded-lg border px-2 py-0.5 font-semibold transition cursor-pointer ${
                showAllPlaces
                  ? 'border-amber-500/50 bg-amber-950/40 text-amber-300'
                  : 'border-slate-700 bg-slate-800/80 text-slate-400'
              }`}
            >
              {showAllPlaces ? '📍 24 Lugares Visibles' : '📍 Mostrar 24 Lugares'}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* LIENZO PRINCIPAL DEL MAPA (PROTAGONISTA ABSOLUTO) */}
      {/* ============================================================ */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <ArequipaMapView
          nodes={nodes}
          edges={edges}
          places={places}
          source={source}
          target={target}
          sourcePlace={sourcePlace}
          targetPlace={targetPlace}
          placeLinkMode={placeLinkMode}
          setPlaceLinkMode={setPlaceLinkMode}
          showAllPlaces={showAllPlaces}
          setShowAllPlaces={setShowAllPlaces}
          onSelectSource={(nid) => handleSelectCorner(nid, 'source')}
          onSelectTarget={(nid) => handleSelectCorner(nid, 'target')}
          onSelectPlace={handleSelectPlace}
          onToggleEdgeClosure={handleToggleEdgeClosure}
          onGraphMutated={onGraphMutated}
          showToast={showToast}
          transportMode={transportMode}
          mapViewMode={mapViewMode}
          activeRouteEdges={activeRouteEdges}
          activeRouteNodes={activeRouteNodes}
          mstEdges={mstEdges}
          showMstOverlay={showMstOverlay}
          hiveRoutes={activeHiveRoutes}
          negativeCycleNodes={negativeCycleNodes}
          tourResult={tourResult}
          selectionClickMode={selectionClickMode}
          setSelectionClickMode={setSelectionClickMode}
          mapHeightClass="h-[680px] lg:h-[750px]"
          fleetSimulation={fleetSimulation}
        />

        {/* ============================================================ */}
        {/* PANEL FLOTANTE DE SIMULACIÓN DE FLOTA (ARRIBA A LA DERECHA) */}
        {/* ============================================================ */}
        {showSimWidget && (
          <div className="absolute top-4 right-4 z-30 w-84 rounded-2xl border border-indigo-500/50 bg-slate-900/95 p-4 shadow-2xl backdrop-blur space-y-3 transition-all select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Car className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Despacho de Flota en Vivo</h4>
                  <p className="text-[10px] text-slate-400">Prueba de Reducción de Tráfico</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimWidget(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Selector de Cantidad de Autos */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Autos a Despachar:
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 15, 45, 90].map((count) => (
                  <button
                    key={`fleet-${count}`}
                    type="button"
                    onClick={() =>
                      setFleetSimulation((prev) => ({
                        ...prev,
                        fleetSize: count,
                        progress: 0,
                        running: false
                      }))
                    }
                    className={`rounded-lg py-1.5 text-center text-xs font-bold transition cursor-pointer ${
                      fleetSimulation.fleetSize === count
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {count} veh
                  </button>
                ))}
              </div>
            </div>

            {/* Estrategia de Ruteo */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Estrategia Algorítmica:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setFleetSimulation((prev) => ({
                      ...prev,
                      strategy: 'hive',
                      progress: 0,
                      running: false
                    }));
                    setMapOverlayMode('hive');
                  }}
                  className={`rounded-xl border p-2 text-left transition cursor-pointer ${
                    fleetSimulation.strategy === 'hive'
                      ? 'border-purple-400 bg-purple-950/40 text-purple-200'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🧠 Colmena</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Yen K-Rutas + Bonos
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFleetSimulation((prev) => ({
                      ...prev,
                      strategy: 'selfish',
                      progress: 0,
                      running: false
                    }));
                    setMapOverlayMode('individual');
                  }}
                  className={`rounded-xl border p-2 text-left transition cursor-pointer ${
                    fleetSimulation.strategy === 'selfish'
                      ? 'border-rose-400 bg-rose-950/40 text-rose-200'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🔴 Ruta Única</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Atasco por saturación
                  </div>
                </button>
              </div>
            </div>

            {/* Barra de Progreso de la Salida */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Progreso del Recorrido:</span>
                <span className="font-bold text-cyan-300">
                  {Math.round(fleetSimulation.progress * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-75 ${
                    fleetSimulation.strategy === 'selfish'
                      ? 'bg-rose-500'
                      : 'bg-gradient-to-r from-cyan-400 via-purple-400 to-indigo-400'
                  }`}
                  style={{ width: `${Math.round(fleetSimulation.progress * 100)}%` }}
                />
              </div>
            </div>

            {/* Botones de Control de la Simulación */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (fleetSimulation.progress >= 1) {
                    setFleetSimulation((prev) => ({ ...prev, progress: 0, running: true, paused: false }));
                  } else {
                    setFleetSimulation((prev) => ({
                      ...prev,
                      running: !prev.running,
                      paused: prev.running ? true : false
                    }));
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold shadow cursor-pointer transition ${
                  fleetSimulation.running
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white'
                }`}
              >
                {fleetSimulation.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>
                  {fleetSimulation.running
                    ? 'Pausar'
                    : fleetSimulation.progress >= 1
                    ? 'Relanzar Flota'
                    : 'Despachar Autos'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFleetSimulation((prev) => ({
                    ...prev,
                    running: false,
                    paused: false,
                    progress: 0
                  }))
                }
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 p-2 text-slate-300 hover:text-white cursor-pointer transition"
                title="Reiniciar Simulación"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Diagnóstico Comparativo en Tiempo Real */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-[11px] leading-relaxed">
              {fleetSimulation.strategy === 'selfish' ? (
                <div className="text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span>Colapso por Tráfico No Coordinado:</span>
                  </div>
                  <p className="text-slate-400">
                    Los <strong>{fleetSimulation.fleetSize} autos</strong> saturan la misma vía. Demora estimada: <strong>+80% a +140%</strong>.
                  </p>
                </div>
              ) : (
                <div className="text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>Reducción de Tráfico Activa:</span>
                  </div>
                  <p className="text-slate-400">
                    Flota repartida en <strong>{hiveResult?.k_routes?.length || 3} rutas alternas</strong>. Vías fluidas (&lt;50% capacidad).
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TARJETA FLOTANTE DE RESULTADOS DE RUTA (Abajo a la derecha) */}
        {/* ============================================================ */}
        {showRouteCard && activeMetrics && (
          <div className="absolute bottom-4 right-4 z-20 max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur space-y-2.5 select-none transition-all">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Ruta Vial Calculada (Esquina a Esquina)
                </span>
                <h4 className="font-bold text-white text-sm leading-snug">
                  {sourcePlace ? `📍 ${sourcePlace.name}` : sourceNode?.name || `Esq. #${source}`} ➔{' '}
                  {targetPlace ? `📍 ${targetPlace.name}` : targetNode?.name || `Esq. #${target}`}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Vía Esquina #{source} ➔ Esquina #{target}
                  {extraAccessMeters > 0 ? ` (+${extraAccessMeters} m acceso punteado)` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRouteCard(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Minimizar tarjeta de ruta"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Métricas Clave */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-center">
                <span className="block text-[10px] text-slate-400 font-sans">Tiempo Estimado</span>
                <span className="text-base font-bold text-emerald-400">{totalTimeMin} min</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-center">
                <span className="block text-[10px] text-slate-400 font-sans">Distancia</span>
                <span className="text-base font-bold text-cyan-400">{totalDistKm} km</span>
              </div>
            </div>

            {/* Algoritmo y Tiempo C++20 */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Algoritmo:</span>
                <span className="font-bold text-amber-300">
                  {activeMetrics.algorithm_name?.split('(')[0] || 'Óptimo'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400">Tiempo std::chrono:</span>
                <span className="font-bold text-emerald-300">
                  {activeMetrics.execution_time_us < 0.01
                    ? `${activeMetrics.execution_time_us.toFixed(4)} µs (Caché)`
                    : `${activeMetrics.execution_time_us.toFixed(2)} µs`}
                </span>
              </div>
            </div>

            {/* Razón corta de selección */}
            <p className="text-[11px] text-slate-300 leading-tight">
              {routeResponse?.selection_reason ||
                'Ruta calculada con penalización dinámica de congestión vehicular.'}
            </p>
          </div>
        )}

        {/* Botón para restaurar la tarjeta de ruta si se cerró */}
        {!showRouteCard && (
          <button
            type="button"
            onClick={() => setShowRouteCard(true)}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-white shadow-xl backdrop-blur cursor-pointer"
          >
            <Navigation className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ver Resumen de Ruta</span>
          </button>
        )}

        {/* ============================================================ */}
        {/* PÍLDORAS FLOTANTES DE ACCESO RÁPIDO (Abajo a la izquierda) */}
        {/* ============================================================ */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2">
          {/* Toggle de Simulación de Despacho */}
          <button
            type="button"
            onClick={() => setShowSimWidget(!showSimWidget)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-xl backdrop-blur transition cursor-pointer ${
              showSimWidget || fleetSimulation.running
                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Car className="h-3.5 w-3.5 text-emerald-400" />
            <span>{showSimWidget ? 'Ocultar Despacho' : '🚗 Despachar Flota'}</span>
          </button>

          {/* Toggle Rápido de Telemetría */}
          <button
            type="button"
            onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-xl backdrop-blur transition cursor-pointer ${
              showTelemetryDetails
                ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            <span>{showTelemetryDetails ? 'Ocultar Telemetría' : '📊 Telemetría C++20'}</span>
          </button>

          {/* Toggle Rápido de Mente Colmena */}
          <button
            type="button"
            onClick={() => setShowHiveDetails(!showHiveDetails)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-xl backdrop-blur transition cursor-pointer ${
              showHiveDetails
                ? 'border-purple-400 bg-purple-500/25 text-purple-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <span>
              {showHiveDetails
                ? 'Ocultar Flota Colmena'
                : `🧠 Flota Colmena (${hiveResult?.fleet_config?.concurrent_vehicles || 85} veh)`}
            </span>
          </button>

          {/* Alerta de Cierres si existen */}
          {closedEdgesList.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrawerTab('closures');
                setDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-950/80 px-3 py-2 text-xs font-bold text-rose-300 shadow-xl backdrop-blur cursor-pointer hover:bg-rose-900/80 transition"
            >
              <Ban className="h-3.5 w-3.5 text-rose-400" />
              <span>{closedEdgesList.length} Vía(s) Cerrada(s)</span>
            </button>
          )}

          {/* Alerta de Tour Turístico si existe */}
          {tourResult && (
            <div className="flex items-center gap-2 rounded-xl border border-orange-500/50 bg-orange-950/80 px-3 py-2 text-xs font-bold text-orange-200 shadow-xl backdrop-blur">
              <Compass className="h-3.5 w-3.5 text-orange-400" />
              <span>Tour Google Places: {tourResult.selected_places?.length} paradas</span>
              <button
                type="button"
                onClick={() => setTourResult(null)}
                className="text-slate-400 hover:text-white font-normal ml-1"
              >
                (Cerrar)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* PANELES COMPLEMENTARIOS CONDICIONALES (Debajo del mapa) */}
      {/* ============================================================ */}
      {showHiveDetails && (
        <div className="rounded-2xl border border-purple-500/30 bg-slate-900/95 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <Users className="h-4 w-4 text-purple-400" />
              <span>Distribución de Flota Multi-Usuario (Yen + Bonos Bellman-Ford)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHiveDetails(false)}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              ✕ Ocultar
            </button>
          </div>
          <HiveMindPanel
            nodes={nodes}
            source={source}
            target={target}
            onRunHiveMind={handleRunHiveMind}
            hiveResult={hiveResult}
            loading={loading}
          />
        </div>
      )}

      {showTelemetryDetails && (
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900/95 p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <span>Telemetría Algorítmica C++20 (std::chrono de Alta Resolución)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowTelemetryDetails(false)}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              ✕ Ocultar
            </button>
          </div>
          <TelemetryPanel
            routeResponse={routeResponse}
            nodes={nodes}
            inspectedAlgoId={inspectedAlgoId}
            setInspectedAlgoId={setInspectedAlgoId}
            showMstOverlay={showMstOverlay}
            setShowMstOverlay={setShowMstOverlay}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* MENÚ LATERAL DESPLEGABLE (DRAWER) */}
      {/* ============================================================ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Panel Lateral Drawer */}
          <div className="relative z-50 w-full max-w-md bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Header del Drawer */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configuración &amp; Herramientas</h3>
                  <p className="text-[11px] text-slate-400">Ejercicio 09 — Tráfico &amp; Colmena</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pestañas de navegación interna del Drawer */}
            <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/40 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDrawerTab('tools')}
                className={`py-2.5 text-center transition cursor-pointer ${
                  drawerTab === 'tools'
                    ? 'border-b-2 border-cyan-400 text-cyan-300 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚙️ Ajustes
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('hive')}
                className={`py-2.5 text-center transition cursor-pointer ${
                  drawerTab === 'hive'
                    ? 'border-b-2 border-purple-400 text-purple-300 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🧠 Colmena
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('closures')}
                className={`py-2.5 text-center transition cursor-pointer ${
                  drawerTab === 'closures'
                    ? 'border-b-2 border-rose-400 text-rose-300 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🚧 Cierres ({closedEdgesList.length})
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('views')}
                className={`py-2.5 text-center transition cursor-pointer ${
                  drawerTab === 'views'
                    ? 'border-b-2 border-amber-400 text-amber-300 bg-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👁️ Vista
              </button>
            </div>

            {/* Contenido scrolleable del Drawer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* TAB 1: HERRAMIENTAS Y SIMULACIÓN */}
              {drawerTab === 'tools' && (
                <div className="space-y-4">
                  {/* Master Toggle de Modo de Algoritmo */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-400" />
                      Modo de Ejecución Algorítmica:
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompareAllAlgorithms(!compareAllAlgorithms)}
                      className={`w-full rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        compareAllAlgorithms
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                          : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                      }`}
                    >
                      <div className="font-bold">
                        {compareAllAlgorithms
                          ? '⚡ Modo Benchmark: 7 Algoritmos a la vez'
                          : '🧠 Modo Inteligente: Selección Automática'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {compareAllAlgorithms
                          ? 'Ejecuta simultáneamente Floyd O(1), Floyd O(V³), Dijkstra, Bellman-Ford y Kruskal para medir std::chrono.'
                          : 'Usa Floyd Caché O(1) por defecto, Dijkstra en cierres y Bellman-Ford en bonos.'}
                      </div>
                    </button>
                  </div>

                  {/* Vista de Mapa: Google Maps vs Esquema */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-cyan-400" />
                      Motor de Visualización del Mapa:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMapViewMode('google')}
                        className={`rounded-xl border p-2 font-semibold text-center transition cursor-pointer ${
                          mapViewMode === 'google'
                            ? 'border-cyan-400 bg-cyan-600/30 text-cyan-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        🌍 Google Maps Real
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapViewMode('schema')}
                        className={`rounded-xl border p-2 font-semibold text-center transition cursor-pointer ${
                          mapViewMode === 'schema'
                            ? 'border-indigo-400 bg-indigo-600/30 text-indigo-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        🕸️ Esquema de Grafo
                      </button>
                    </div>
                  </div>

                  {/* Generadores de Tráfico y Limpieza */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5">
                    <span className="font-bold text-slate-200 text-xs">Control y Simulación de Tráfico:</span>

                    {/* Botón Principal: Limpiar Tráfico (Todas las Rutas a Verde) */}
                    <button
                      type="button"
                      onClick={() => {
                        setTransportMode('car');
                        handleRandomizeTraffic('clear');
                        setDrawerOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-950/50 hover:bg-emerald-900/60 py-2.5 font-bold text-emerald-300 hover:text-emerald-100 shadow-lg shadow-emerald-950/40 cursor-pointer transition"
                      title="Establece todas las vías a flujo libre fluido (< 50% de capacidad), pintando todas las rutas de verde esmeralda"
                    >
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <span>Limpiar Tráfico (Todas las Rutas a Verde)</span>
                    </button>

                    {/* Modo Peatonal / A Pie (Grafo No Dirigido) */}
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Footprints className="h-4 w-4 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white">Modo Peatonal (A Pie)</div>
                          <div className="text-[10px] text-slate-400">Grafo bidireccional libre de congestión</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = transportMode === 'pedestrian' ? 'car' : 'pedestrian';
                          setTransportMode(nextMode);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                          transportMode === 'pedestrian'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {transportMode === 'pedestrian' ? '🟢 Activo' : '⚪ Inactivo'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTransportMode('car');
                          handleRandomizeTraffic('mixed');
                          setDrawerOpen(false);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-2 font-semibold text-slate-200 cursor-pointer transition"
                      >
                        <Shuffle className="h-3.5 w-3.5 text-amber-400" />
                        Tráfico Aleatorio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransportMode('car');
                          handleRandomizeTraffic('rush_hour');
                          setDrawerOpen(false);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 py-2 font-semibold text-amber-200 cursor-pointer transition"
                      >
                        🚦 Hora Punta
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleRandomTour();
                        setDrawerOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 py-2.5 font-bold text-white shadow cursor-pointer transition"
                    >
                      <Compass className="h-4 w-4" />
                      Tour Turístico Aleatorio (Google Places)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            '¿Seguro que deseas restaurar la red urbana? Esto limpiará cierres de vía y recalculará la matriz Floyd-Warshall O(1), preservando intactas tus esquinas y vías personalizadas.'
                          )
                        ) {
                          handleResetSystem();
                          setDrawerOpen(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-2 font-medium text-slate-400 hover:text-white cursor-pointer transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar Tráfico Base y Recalcular Floyd SQLite O(1)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: MENTE COLMENA MULTI-USUARIO */}
              {drawerTab === 'hive' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-3">
                    <span className="font-bold text-purple-300 text-xs flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-purple-400" />
                      Parámetros de la Flota (Algoritmo de Yen):
                    </span>

                    <div>
                      <div className="flex justify-between font-semibold text-slate-200 mb-1">
                        <span>Vehículos Concurrentes:</span>
                        <span className="text-cyan-300 font-bold">
                          {hiveResult?.fleet_config?.concurrent_vehicles || 85} veh
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="180"
                        step="5"
                        defaultValue="85"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleRunHiveMind({
                            source,
                            target,
                            kPaths: hiveResult?.fleet_config?.k_paths || 3,
                            concurrentVehicles: val,
                            injectNegativeCycle: false
                          });
                        }}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold text-slate-200 mb-1">
                        <span>Rutas Alternativas (K):</span>
                        <span className="text-purple-300 font-bold">
                          K = {hiveResult?.fleet_config?.k_paths || 3}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="4"
                        step="1"
                        defaultValue="3"
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleRunHiveMind({
                            source,
                            target,
                            kPaths: val,
                            concurrentVehicles: hiveResult?.fleet_config?.concurrent_vehicles || 85,
                            injectNegativeCycle: false
                          });
                        }}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2 border-t border-purple-500/20">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setShowSimWidget(true);
                          setDrawerOpen(false);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 py-2.5 font-bold text-white shadow cursor-pointer transition"
                      >
                        <Car className="h-4 w-4" />
                        Abrir Despacho de Flota en Vivo
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          handleRunHiveMind({
                            source,
                            target,
                            kPaths: hiveResult?.fleet_config?.k_paths || 3,
                            concurrentVehicles: hiveResult?.fleet_config?.concurrent_vehicles || 85,
                            injectNegativeCycle: false
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-2 font-bold text-white shadow cursor-pointer transition"
                      >
                        <Sparkles className="h-4 w-4" />
                        Recalcular Distribución de Flota
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          handleRunHiveMind({
                            source,
                            target,
                            kPaths: hiveResult?.fleet_config?.k_paths || 3,
                            concurrentVehicles: hiveResult?.fleet_config?.concurrent_vehicles || 85,
                            injectNegativeCycle: true
                          })
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 py-2 font-semibold text-rose-200 cursor-pointer transition"
                      >
                        <Ban className="h-3.5 w-3.5 text-rose-400" />
                        Inyectar Ciclo Negativo (Prueba Bellman-Ford)
                      </button>
                    </div>
                  </div>

                  {/* Vías con Subsidios Negativos Activos */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-purple-300">
                      <span>Vías con Incentivo Negativo (&lt; 0s):</span>
                      <span className="font-mono font-bold">{negativeEdgesList.length}</span>
                    </div>
                    {negativeEdgesList.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">
                        No hay incentivos negativos activos en este momento.
                      </p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {negativeEdgesList.map((e) => (
                          <div
                            key={`neg-${e.id}`}
                            className="flex items-center justify-between rounded-lg bg-purple-950/40 border border-purple-500/20 px-2 py-1 text-[11px] text-purple-200"
                          >
                            <span className="truncate pr-2">{e.street_name}</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {e.hive_bonus.toFixed(1)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CIERRES DE VÍA */}
              {drawerTab === 'closures' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>Estado de la Caché Floyd-Warshall:</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          summary?.floyd_cache_valid
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {summary?.floyd_cache_valid ? 'Caché O(1) VÁLIDA' : 'INVALIDADA (Usa Dijkstra)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Haz clic en cualquier calle para simular una obra o bloqueo. Si cierras una vía, la caché de Floyd se invalida y el sistema conmuta automáticamente a <strong>Dijkstra O(E log V)</strong>.
                    </p>
                  </div>

                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {edges.map((e) => (
                      <div
                        key={`edge-item-${e.id}`}
                        onClick={() => handleToggleEdgeClosure(e.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs cursor-pointer transition ${
                          e.is_closed
                            ? 'border-rose-500/60 bg-rose-950/30 text-rose-200'
                            : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono text-[10px] text-slate-500 mr-1.5">[E{e.id}]</span>
                          <span className="font-medium">{e.street_name}</span>
                        </div>
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${
                            e.is_closed
                              ? 'bg-rose-500 text-white'
                              : e.occupancy_ratio >= 0.85
                              ? 'bg-rose-500/20 text-rose-300'
                              : e.occupancy_ratio >= 0.5
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {e.is_closed ? 'BLOQUEADA' : `${e.current_vehicles}/${e.max_vehicles} veh`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: VISTAS Y WIDGETS EN PANTALLA PRINCIPAL */}
              {drawerTab === 'views' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Eye className="h-4 w-4 text-cyan-400" />
                      Widgets y Paneles Visibles sobre el Mapa:
                    </span>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showSimWidget}
                        onChange={(e) => setShowSimWidget(e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <span className="text-slate-200">
                        Mostrar <strong>Widget de Despacho de Flota</strong> sobre el mapa
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showRouteCard}
                        onChange={(e) => setShowRouteCard(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      <span className="text-slate-200">
                        Mostrar <strong>Tarjeta Flotante de Resumen de Ruta</strong>
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showHiveDetails}
                        onChange={(e) => setShowHiveDetails(e.target.checked)}
                        className="accent-purple-500"
                      />
                      <span className="text-slate-200">
                        Mostrar <strong>Panel de Mente Colmena</strong> debajo del mapa
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showTelemetryDetails}
                        onChange={(e) => setShowTelemetryDetails(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span className="text-slate-200">
                        Mostrar <strong>Panel de Telemetría C++20</strong> debajo del mapa
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer del Drawer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                Cerrar Menú y Volver al Mapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
