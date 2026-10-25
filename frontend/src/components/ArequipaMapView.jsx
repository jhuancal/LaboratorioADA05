import React, { useEffect, useRef, useState, useMemo } from 'react';
import { api } from '../services/api.js';
import {
  AlertTriangle,
  Navigation,
  Ban,
  Sparkles,
  CheckCircle2,
  GitBranch,
  Car,
  Wrench,
  MapPin,
  Plus,
  Link2,
  Move,
  Trash2
} from 'lucide-react';

const GOOGLE_MAPS_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDX6QjBjev5OiY5Yh-BtahdHmfGOJpVehc';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#e2e8f0' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334155' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0284c7' }]
  }
];

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.getElementById('google-maps-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps));
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = (e) => reject(new Error('Fallo al cargar Google Maps API'));
    document.head.appendChild(script);
  });
}

function getEdgeColor(edge, mode) {
  if (edge.is_closed) return '#ef4444'; // Rojo si cerrada
  if (edge.hive_bonus < -0.01) return '#c084fc'; // Violeta brillante si bono colmena
  if (mode === 'pedestrian') return '#10b981'; // Verde esmeralda si peatonal
  const ratio = edge.max_vehicles > 0 ? edge.current_vehicles / edge.max_vehicles : 0;
  if (ratio >= 0.85) return '#f43f5e'; // Rojo congestión
  if (ratio >= 0.50) return '#f59e0b'; // Ámbar medio
  return '#22c55e'; // Verde fluido
}

// Helpers de interpolación para la animación de vehículos
function interpolateGps(coords, progress) {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1 || progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  let totalDist = 0;
  const dists = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    const dLat = coords[i + 1].lat - coords[i].lat;
    const dLng = coords[i + 1].lng - coords[i].lng;
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    totalDist += d;
    dists.push(totalDist);
  }

  if (totalDist === 0) return coords[0];
  const targetDist = progress * totalDist;

  for (let i = 0; i < dists.length - 1; i++) {
    if (targetDist >= dists[i] && targetDist <= dists[i + 1]) {
      const segLen = dists[i + 1] - dists[i];
      const t = segLen > 0 ? (targetDist - dists[i]) / segLen : 0;
      return {
        lat: coords[i].lat + t * (coords[i + 1].lat - coords[i].lat),
        lng: coords[i].lng + t * (coords[i + 1].lng - coords[i].lng)
      };
    }
  }
  return coords[coords.length - 1];
}

function interpolateSvg(coords, progress) {
  if (!coords || coords.length === 0) return null;
  if (coords.length === 1 || progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  let totalDist = 0;
  const dists = [0];
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1].x - coords[i].x;
    const dy = coords[i + 1].y - coords[i].y;
    const d = Math.hypot(dx, dy);
    totalDist += d;
    dists.push(totalDist);
  }

  if (totalDist === 0) return coords[0];
  const targetDist = progress * totalDist;

  for (let i = 0; i < dists.length - 1; i++) {
    if (targetDist >= dists[i] && targetDist <= dists[i + 1]) {
      const segLen = dists[i + 1] - dists[i];
      const t = segLen > 0 ? (targetDist - dists[i]) / segLen : 0;
      return {
        x: coords[i].x + t * (coords[i + 1].x - coords[i].x),
        y: coords[i].y + t * (coords[i + 1].y - coords[i].y)
      };
    }
  }
  return coords[coords.length - 1];
}

export default function ArequipaMapView({
  nodes = [],
  edges = [],
  places = [],
  source,
  target,
  sourcePlace = null,
  targetPlace = null,
  placeLinkMode = 'nearest',
  setPlaceLinkMode,
  showAllPlaces = true,
  setShowAllPlaces,
  onSelectSource,
  onSelectTarget,
  onSelectPlace,
  onToggleEdgeClosure,
  onGraphMutated,
  showToast,
  transportMode = 'car',
  mapViewMode = 'google',
  activeRouteEdges = [],
  activeRouteNodes = [],
  mstEdges = [],
  showMstOverlay = false,
  hiveRoutes = [],
  negativeCycleNodes = [],
  tourResult = null,
  selectionClickMode,
  setSelectionClickMode,
  mapHeightClass = 'h-[720px] lg:h-[780px]',
  fleetSimulation = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlaysRef = useRef({ markers: [], polylines: [], mapClickListener: null });
  const simCarMarkersRef = useRef([]);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);

  // Estado del Editor Interactivo de Esquinas y Aristas en Google Maps
  const [editorMode, setEditorMode] = useState(false);
  const [editorAction, setEditorAction] = useState('drag'); // 'drag' | 'add_corner' | 'connect_corners' | 'delete_edge'
  const [connectFirstNodeId, setConnectFirstNodeId] = useState(null);
  const [deleteFirstNodeId, setDeleteFirstNodeId] = useState(null);

  const handleDeleteEdge = async (edgeId) => {
    try {
      const res = await api.deleteStreetEdge(edgeId);
      if (showToast && res.message) showToast(res.message);
      if (onGraphMutated) await onGraphMutated();
    } catch (err) {
      if (showToast) showToast(`Error al eliminar arista: ${err.message}`);
    }
  };

  const handleDeleteEdgeBetween = async (fromId, toId) => {
    try {
      const res = await api.deleteStreetEdgeBetween(fromId, toId);
      if (showToast && res.message) showToast(res.message);
      if (onGraphMutated) await onGraphMutated();
    } catch (err) {
      if (showToast) showToast(`Error al eliminar vía: ${err.message}`);
    }
  };

  const nodeMap = useMemo(() => {
    const m = new Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const hiveEdgeColors = useMemo(() => {
    const map = new Map();
    const kColors = ['#38bdf8', '#c084fc', '#f472b6', '#facc15'];
    hiveRoutes.forEach((hr, idx) => {
      const col = kColors[idx % kColors.length];
      (hr.path_edges || []).forEach((eid) => {
        if (!map.has(eid)) map.set(eid, { color: col, rank: hr.rank, vehicles: hr.assigned_vehicles });
      });
    });
    return map;
  }, [hiveRoutes]);

  const activeEdgeSet = useMemo(() => new Set(activeRouteEdges), [activeRouteEdges]);
  const mstEdgeSet = useMemo(() => new Set(mstEdges), [mstEdges]);
  const tourEdgeSet = useMemo(
    () => new Set(tourResult?.tour_result?.tour_edges || []),
    [tourResult]
  );
  const tourStopMap = useMemo(() => {
    const m = new Map();
    if (tourResult?.selected_places) {
      for (const p of tourResult.selected_places) {
        m.set(p.node_id, p.stop_order);
      }
    }
    return m;
  }, [tourResult]);

  // Cargar Google Maps JS API
  useEffect(() => {
    let mounted = true;
    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then(() => {
        if (mounted) setMapsLoaded(true);
      })
      .catch((err) => {
        if (mounted) setMapsError(err.message || 'No se pudo cargar Google Maps JS API');
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Inicializar instancia de Google Maps
  useEffect(() => {
    if (!mapsLoaded || mapViewMode !== 'google' || !mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: -16.4010, lng: -71.5335 },
        zoom: 15,
        styles: DARK_MAP_STYLE,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
      });
    }
  }, [mapsLoaded, mapViewMode]);

  // Proyección para la vista de Grafo Didáctico SVG (Esquinas + Lugares)
  const { svgCoords, svgPlaceCoords } = useMemo(() => {
    if (!nodes.length) return { svgCoords: new Map(), svgPlaceCoords: new Map() };
    const allPts = [...nodes, ...places];
    const lats = allPts.map((n) => n.lat);
    const lngs = allPts.map((n) => n.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const width = 960;
    const height = 560;
    const pad = 50;
    const project = (lat, lng) => ({
      x: pad + ((lng - minLng) / Math.max(1e-6, maxLng - minLng)) * (width - pad * 2),
      y: height - pad - ((lat - minLat) / Math.max(1e-6, maxLat - minLat)) * (height - pad * 2)
    });

    const coords = new Map();
    for (const n of nodes) {
      coords.set(n.id, project(n.lat, n.lng));
    }
    const pCoords = new Map();
    for (const p of places) {
      pCoords.set(p.id, project(p.lat, p.lng));
    }
    return { svgCoords: coords, svgPlaceCoords: pCoords };
  }, [nodes, places]);

  // Líneas punteadas (Place ⇢ Esquina Vial) tanto para 1 esquina más cercana como 4 esquinas de la cuadra
  const placeConnectorLines = useMemo(() => {
    const lines = [];
    const visiblePlaces = showAllPlaces
      ? places
      : [sourcePlace, targetPlace].filter(Boolean);

    for (const p of visiblePlaces) {
      if (!p) continue;
      const isSrc = sourcePlace && p.id === sourcePlace.id;
      const isDst = targetPlace && p.id === targetPlace.id;

      if ((isSrc || isDst) && placeLinkMode === 'quad' && Array.isArray(p.quad_corners)) {
        for (const corner of p.quad_corners) {
          const isNearest = corner.id === p.nearest_node_id;
          lines.push({
            id: `quad-${p.id}-${corner.id}`,
            placeId: p.id,
            nodeId: corner.id,
            fromLat: p.lat,
            fromLng: p.lng,
            toLat: corner.lat,
            toLng: corner.lng,
            distanceM: corner.distance_m,
            color: isSrc
              ? isNearest
                ? '#34d399'
                : '#10b981'
              : isNearest
              ? '#fb7185'
              : '#f43f5e',
            weight: isNearest ? 3.8 : 2.2,
            opacity: isNearest ? 1.0 : 0.65,
            isActiveEndpoint: true,
            isPrimaryCorner: isNearest
          });
        }
      } else {
        const nearestNode = nodeMap.get(p.nearest_node_id);
        const toLat = nearestNode ? nearestNode.lat : p.nearest_node_lat;
        const toLng = nearestNode ? nearestNode.lng : p.nearest_node_lng;
        if (toLat !== undefined && toLng !== undefined) {
          lines.push({
            id: `near-${p.id}-${p.nearest_node_id}`,
            placeId: p.id,
            nodeId: p.nearest_node_id,
            fromLat: p.lat,
            fromLng: p.lng,
            toLat,
            toLng,
            distanceM: p.access_distance_m,
            color: isSrc ? '#34d399' : isDst ? '#fb7185' : '#fbbf24',
            weight: isSrc || isDst ? 3.8 : 2.1,
            opacity: isSrc || isDst ? 1.0 : 0.62,
            isActiveEndpoint: Boolean(isSrc || isDst),
            isPrimaryCorner: true
          });
        }
      }
    }
    return lines;
  }, [places, showAllPlaces, sourcePlace, targetPlace, placeLinkMode, nodeMap]);

  // Vehículos Simulados en Tiempo Real
  const simulatedVehicles = useMemo(() => {
    if (!fleetSimulation?.running && (!fleetSimulation || fleetSimulation.progress === 0)) {
      return [];
    }

    const N = fleetSimulation.fleetSize || 5;
    const isSelfish = fleetSimulation.strategy === 'selfish';
    const kColors = ['#38bdf8', '#c084fc', '#f472b6', '#facc15'];

    let routesPool = [];
    if (isSelfish || !hiveRoutes || hiveRoutes.length === 0) {
      routesPool = [{
        nodes: activeRouteNodes,
        color: '#ef4444',
        name: 'Ruta Única (Dijkstra Egoísta)'
      }];
    } else {
      routesPool = hiveRoutes.map((hr, idx) => ({
        nodes: hr.path_nodes || activeRouteNodes,
        color: kColors[idx % kColors.length],
        name: `Ruta Colmena #${hr.rank}`
      }));
    }

    const list = [];
    for (let i = 0; i < N; i++) {
      const routeObj = isSelfish ? routesPool[0] : routesPool[i % routesPool.length];
      const nodeGpsList = (routeObj.nodes || [])
        .map((nid) => nodeMap.get(nid))
        .filter(Boolean)
        .map((n) => ({ lat: n.lat, lng: n.lng }));

      const nodeSvgList = (routeObj.nodes || [])
        .map((nid) => svgCoords.get(nid))
        .filter(Boolean);

      // Desfase escalonado de salida (ráfaga ordenada en convoy)
      const maxStagger = 0.32;
      const stagger = N > 1 ? (i / N) * maxStagger : 0;
      const rawP = fleetSimulation.progress || 0;
      const effectiveP = Math.min(1, Math.max(0, (rawP - stagger) / (1 - maxStagger)));

      const gps = interpolateGps(nodeGpsList, effectiveP);
      const svg = interpolateSvg(nodeSvgList, effectiveP);

      list.push({
        id: i + 1,
        color: isSelfish ? '#ef4444' : routeObj.color,
        routeName: routeObj.name,
        progress: effectiveP,
        hasDeparted: rawP >= stagger,
        hasArrived: effectiveP >= 1,
        gps,
        svg
      });
    }

    return list;
  }, [
    fleetSimulation?.running,
    fleetSimulation?.progress,
    fleetSimulation?.fleetSize,
    fleetSimulation?.strategy,
    activeRouteNodes,
    hiveRoutes,
    nodeMap,
    svgCoords
  ]);

  // Dibujar Marcadores y Aristas sobre Google Maps
  useEffect(() => {
    if (!mapsLoaded || mapViewMode !== 'google' || !mapInstanceRef.current) return;
    const gmaps = window.google.maps;
    const map = mapInstanceRef.current;

    // Limpiar overlays previos
    overlaysRef.current.markers.forEach((m) => m.setMap(null));
    overlaysRef.current.polylines.forEach((p) => p.setMap(null));
    if (overlaysRef.current.mapClickListener) {
      gmaps.event.removeListener(overlaysRef.current.mapClickListener);
    }
    overlaysRef.current = { markers: [], polylines: [], mapClickListener: null };

    // Listener de clic en el mapa para agregar nuevas esquinas en modo Editor
    if (editorMode && editorAction === 'add_corner') {
      overlaysRef.current.mapClickListener = map.addListener('click', async (ev) => {
        if (!ev.latLng) return;
        const lat = Number(ev.latLng.lat().toFixed(6));
        const lng = Number(ev.latLng.lng().toFixed(6));
        try {
          const res = await api.createCornerNode({
            name: 'Esq. Personalizada',
            zone: 'Centro Histórico',
            lat,
            lng,
            connectToNodeId: source
          });
          if (showToast && res.message) showToast(res.message);
          if (onGraphMutated) await onGraphMutated();
        } catch (err) {
          if (showToast) showToast(`Error al crear esquina: ${err.message}`);
        }
      });
    }

    const hasHiveRoutes = Boolean(hiveRoutes && hiveRoutes.length > 0);

    // 1. Polilíneas de todas las calles del grafo de Arequipa (Esquina ↔ Esquina)
    for (const edge of edges) {
      const u = nodeMap.get(edge.from);
      const v = nodeMap.get(edge.to);
      if (!u || !v) continue;

      const isPrimaryRoute = !hasHiveRoutes && activeEdgeSet.has(edge.id);
      const isTourEdge = tourEdgeSet.has(edge.id);
      const isMstEdge = showMstOverlay && mstEdgeSet.has(edge.id);
      const hiveInfo = hiveEdgeColors.get(edge.id);

      let strokeColor = getEdgeColor(edge, transportMode);
      let strokeWeight = 3.5;
      let strokeOpacity = edge.is_closed ? 0.45 : 0.72;
      let zIndex = 10;

      if (isMstEdge) {
        strokeColor = '#facc15';
        strokeWeight = 5;
        strokeOpacity = 0.9;
        zIndex = 20;
      }
      if (isTourEdge) {
        strokeColor = '#f97316';
        strokeWeight = 6.5;
        strokeOpacity = 0.95;
        zIndex = 35;
      }
      if (isPrimaryRoute && !hiveInfo) {
        strokeColor = '#38bdf8';
        strokeWeight = 6.5;
        strokeOpacity = 1.0;
        zIndex = 40;
      }
      if (hiveInfo) {
        strokeColor = hiveInfo.color;
        strokeWeight = 6.5;
        strokeOpacity = 1.0;
        zIndex = 45;
      }

      const icons = [];
      if (edge.is_directed && transportMode === 'car' && !edge.is_closed) {
        icons.push({
          icon: {
            path: gmaps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: isPrimaryRoute ? 3.2 : 2.2,
            strokeColor: strokeColor,
            fillColor: strokeColor,
            fillOpacity: 1
          },
          offset: '55%'
        });
      }

      const poly = new gmaps.Polyline({
        path: [
          { lat: u.lat, lng: u.lng },
          { lat: v.lat, lng: v.lng }
        ],
        geodesic: true,
        strokeColor,
        strokeOpacity,
        strokeWeight,
        zIndex,
        icons,
        map
      });

      poly.addListener('mouseover', () => {
        setHoveredItem({
          type: 'edge',
          data: edge,
          fromName: u.name,
          toName: v.name,
          isDeleteTarget: editorMode && editorAction === 'delete_edge'
        });
      });

      poly.addListener('click', async () => {
        if (editorMode && editorAction === 'delete_edge') {
          await handleDeleteEdge(edge.id);
          return;
        }
        onToggleEdgeClosure(edge.id);
      });

      overlaysRef.current.polylines.push(poly);
    }

    // 1.B. Líneas Punteadas (Lugar Emblemático ⇢ Esquina Vial)
    for (const dLine of placeConnectorLines) {
      const dashedPoly = new gmaps.Polyline({
        path: [
          { lat: dLine.fromLat, lng: dLine.fromLng },
          { lat: dLine.toLat, lng: dLine.toLng }
        ],
        geodesic: true,
        strokeOpacity: 0,
        zIndex: dLine.isActiveEndpoint ? 58 : 25,
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: dLine.opacity,
              strokeColor: dLine.color,
              scale: dLine.weight
            },
            offset: '0',
            repeat: dLine.isActiveEndpoint ? '9px' : '11px'
          }
        ],
        map
      });
      overlaysRef.current.polylines.push(dashedPoly);
    }

    // 2. Resaltar ciclo negativo si Bellman-Ford lo detectó
    if (negativeCycleNodes.length >= 2) {
      const cycleCoords = negativeCycleNodes
        .map((nid) => nodeMap.get(nid))
        .filter(Boolean)
        .map((n) => ({ lat: n.lat, lng: n.lng }));

      const cyclePoly = new gmaps.Polyline({
        path: cycleCoords,
        strokeColor: '#f43f5e',
        strokeOpacity: 1,
        strokeWeight: 8,
        zIndex: 60,
        map
      });
      overlaysRef.current.polylines.push(cyclePoly);
    }

    // 3. Marcadores de las 127 Esquinas Viales (Nodos del Grafo)
    for (const node of nodes) {
      const isSource = node.id === source;
      const isTarget = node.id === target;
      const isOnRoute = !hasHiveRoutes && activeRouteNodes.includes(node.id);
      const tourOrder = tourStopMap.get(node.id);
      const isConnectFirst = editorMode && editorAction === 'connect_corners' && connectFirstNodeId === node.id;
      const isDeleteFirst = editorMode && editorAction === 'delete_edge' && deleteFirstNodeId === node.id;

      let fillColor = '#64748b';
      let scale = editorMode ? 6.5 : 4.2;
      let labelText = editorMode ? `${node.id}` : '';

      if (tourOrder) {
        fillColor = '#f97316';
        scale = 8.5;
        labelText = `T${tourOrder}`;
      }
      if (isOnRoute) {
        fillColor = '#0ea5e9';
        scale = 6.5;
        labelText = `${node.id}`;
      }
      if (isSource) {
        fillColor = '#10b981';
        scale = 8.5;
        labelText = 'A';
      } else if (isTarget) {
        fillColor = '#f43f5e';
        scale = 8.5;
        labelText = 'B';
      }
      if (isConnectFirst) {
        fillColor = '#facc15';
        scale = 9.5;
        labelText = `${node.id}`;
      } else if (isDeleteFirst) {
        fillColor = '#f43f5e';
        scale = 9.5;
        labelText = '✂️';
      }

      const marker = new gmaps.Marker({
        position: { lat: node.lat, lng: node.lng },
        map,
        draggable: Boolean(editorMode && editorAction === 'drag'),
        title: `[Esq. #${node.id}] ${node.name} (${node.zone})`,
        label: labelText
          ? {
              text: labelText,
              color: '#ffffff',
              fontSize: scale >= 8 ? '9px' : '7.5px',
              fontWeight: 'bold'
            }
          : undefined,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale,
          fillColor,
          fillOpacity: 1,
          strokeColor: isSource || isTarget || isOnRoute || editorMode ? '#0f172a' : '#334155',
          strokeWeight: isSource || isTarget || isOnRoute || editorMode ? 1.8 : 1.1
        },
        zIndex: isSource || isTarget ? 95 : isOnRoute ? 80 : 35
      });

      marker.addListener('mouseover', () => {
        setHoveredItem({ type: 'node', data: node });
      });

      if (editorMode && editorAction === 'drag') {
        marker.addListener('dragend', async (ev) => {
          if (!ev.latLng) return;
          const newLat = Number(ev.latLng.lat().toFixed(6));
          const newLng = Number(ev.latLng.lng().toFixed(6));
          try {
            const res = await api.updateNodePosition(node.id, {
              lat: newLat,
              lng: newLng
            });
            if (showToast && res.message) showToast(res.message);
            if (onGraphMutated) await onGraphMutated();
          } catch (err) {
            if (showToast) showToast(`Error al mover esquina: ${err.message}`);
          }
        });
      }

      marker.addListener('click', async () => {
        if (editorMode && editorAction === 'connect_corners') {
          if (connectFirstNodeId === null) {
            setConnectFirstNodeId(node.id);
            if (showToast) {
              showToast(`🔗 Esquina #${node.id} seleccionada. Ahora haz clic en la 2da esquina para conectar.`);
            }
          } else if (connectFirstNodeId === node.id) {
            setConnectFirstNodeId(null);
          } else {
            try {
              const res = await api.createStreetEdge({
                from: connectFirstNodeId,
                to: node.id,
                street_name: `Tramo Esq. #${connectFirstNodeId} - Esq. #${node.id}`,
                is_directed: false
              });
              setConnectFirstNodeId(null);
              if (showToast && res.message) showToast(res.message);
              if (onGraphMutated) await onGraphMutated();
            } catch (err) {
              setConnectFirstNodeId(null);
              if (showToast) showToast(`Error al conectar esquinas: ${err.message}`);
            }
          }
          return;
        }

        if (editorMode && editorAction === 'delete_edge') {
          if (deleteFirstNodeId === null) {
            setDeleteFirstNodeId(node.id);
            if (showToast) {
              showToast(`✂️ Esquina #${node.id} seleccionada. Ahora haz clic en la 2da esquina para eliminar la vía entre ambas (o haz clic directo en la línea de la vía).`);
            }
          } else if (deleteFirstNodeId === node.id) {
            setDeleteFirstNodeId(null);
          } else {
            await handleDeleteEdgeBetween(deleteFirstNodeId, node.id);
            setDeleteFirstNodeId(null);
          }
          return;
        }

        if (selectionClickMode === 'source') {
          onSelectSource(node.id);
          setSelectionClickMode('target');
        } else {
          onSelectTarget(node.id);
          setSelectionClickMode('source');
        }
      });

      overlaysRef.current.markers.push(marker);
    }

    // 4. Marcadores de los 24 Lugares / Hitos Emblemáticos (Diamantes dorados/esmeralda/rosa vinculados por línea punteada)
    const visiblePlaces = showAllPlaces
      ? places
      : [sourcePlace, targetPlace].filter(Boolean);

    for (const place of visiblePlaces) {
      if (!place) continue;
      const isSrcPlace = sourcePlace && place.id === sourcePlace.id;
      const isDstPlace = targetPlace && place.id === targetPlace.id;

      const fillColor = isSrcPlace
        ? '#10b981'
        : isDstPlace
        ? '#f43f5e'
        : '#f59e0b';

      const placeMarker = new gmaps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map,
        title: `📍 ${place.name} ⇢ Esquina Vial #${place.nearest_node_id} (+${place.access_distance_m} m)`,
        label: {
          text: isSrcPlace ? '📍A' : isDstPlace ? '📍B' : `P${place.id}`,
          color: '#ffffff',
          fontSize: isSrcPlace || isDstPlace ? '10px' : '8.5px',
          fontWeight: 'bold'
        },
        icon: {
          path: 'M 0,-11 9,0 0,11 -9,0 Z',
          scale: isSrcPlace || isDstPlace ? 1.15 : 0.9,
          fillColor,
          fillOpacity: 1,
          strokeColor: '#0f172a',
          strokeWeight: 2
        },
        zIndex: isSrcPlace || isDstPlace ? 120 : 70
      });

      placeMarker.addListener('mouseover', () => {
        setHoveredItem({ type: 'place', data: place });
      });

      placeMarker.addListener('click', () => {
        if (!onSelectPlace) return;
        if (selectionClickMode === 'source') {
          onSelectPlace(place.id, 'source');
          setSelectionClickMode('target');
        } else {
          onSelectPlace(place.id, 'target');
          setSelectionClickMode('source');
        }
      });

      overlaysRef.current.markers.push(placeMarker);
    }
  }, [
    mapsLoaded,
    mapViewMode,
    nodes,
    edges,
    places,
    source,
    target,
    sourcePlace,
    targetPlace,
    showAllPlaces,
    placeConnectorLines,
    editorMode,
    editorAction,
    connectFirstNodeId,
    transportMode,
    activeEdgeSet,
    activeRouteNodes,
    mstEdges,
    showMstOverlay,
    hiveRoutes,
    hiveEdgeColors,
    negativeCycleNodes,
    tourStopMap,
    tourResult,
    onSelectSource,
    onSelectTarget,
    onSelectPlace,
    onToggleEdgeClosure,
    onGraphMutated,
    showToast,
    setSelectionClickMode
  ]);

  // Actualizar marcadores de autos simulados en Google Maps
  useEffect(() => {
    if (!mapsLoaded || mapViewMode !== 'google' || !mapInstanceRef.current) return;
    const gmaps = window.google.maps;

    if (!fleetSimulation?.running && (!fleetSimulation || fleetSimulation.progress === 0)) {
      simCarMarkersRef.current.forEach((m) => m.setMap(null));
      simCarMarkersRef.current = [];
      return;
    }

    while (simCarMarkersRef.current.length < simulatedVehicles.length) {
      const idx = simCarMarkersRef.current.length;
      const v = simulatedVehicles[idx];
      const m = new gmaps.Marker({
        position: v.gps || { lat: -16.4, lng: -71.53 },
        map: mapInstanceRef.current,
        zIndex: 250,
        label: {
          text: `${v.id}`,
          color: '#ffffff',
          fontSize: '9px',
          fontWeight: 'bold'
        },
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: v.color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
      simCarMarkersRef.current.push(m);
    }

    while (simCarMarkersRef.current.length > simulatedVehicles.length) {
      const m = simCarMarkersRef.current.pop();
      if (m) m.setMap(null);
    }

    simulatedVehicles.forEach((v, idx) => {
      const m = simCarMarkersRef.current[idx];
      if (!m) return;
      if (v.gps && v.hasDeparted) {
        m.setVisible(true);
        m.setPosition({ lat: v.gps.lat, lng: v.gps.lng });
        m.setIcon({
          path: gmaps.SymbolPath.CIRCLE,
          scale: 9.5,
          fillColor: v.color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        });
      } else {
        m.setVisible(false);
      }
    });
  }, [simulatedVehicles, mapsLoaded, mapViewMode, fleetSimulation]);

  return (
    <div className="relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
      {/* Barra Superior del Mapa */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Botón Editor Interactivo de Esquinas */}
          <button
            type="button"
            onClick={() => {
              setEditorMode((prev) => !prev);
              setConnectFirstNodeId(null);
              setDeleteFirstNodeId(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              editorMode
                ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow'
                : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Activar el editor interactivo para mover esquinas arrastrándolas, agregar nuevas esquinas, conectar calles o eliminar aristas"
          >
            <Wrench className="h-3.5 w-3.5 text-amber-400" />
            <span>{editorMode ? '🛠️ Cerrar Editor de Esquinas' : '🛠️ Editar Esquinas'}</span>
          </button>

          {fleetSimulation?.running && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 animate-pulse">
              <Car className="h-3.5 w-3.5" />
              Flota en Marcha ({Math.round((fleetSimulation.progress || 0) * 100)}%)
            </span>
          )}
        </div>

        {/* Leyenda de Colores de Tráfico + Línea Punteada */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
          <span className="flex items-center gap-1 text-amber-300 font-semibold">
            <span>◆</span> Lugar ⇢ ⚪ Esquina (Punteada)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &lt;50% Fluido
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 50-85% Medio
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> &gt;85% Saturado
          </span>
          <span className="flex items-center gap-1 text-sky-300">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Ruta Activa
          </span>
        </div>
      </div>

      {/* Barra Flotante de Herramientas del Editor de Esquinas */}
      {editorMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-950/30 px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              Editor de Esquinas en Vivo:
            </span>
            <button
              type="button"
              onClick={() => {
                setEditorAction('drag');
                setConnectFirstNodeId(null);
                setDeleteFirstNodeId(null);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                editorAction === 'drag'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Move className="h-3.5 w-3.5" />
              <span>✋ Mover Esquina (Arrastrar)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorAction('add_corner');
                setConnectFirstNodeId(null);
                setDeleteFirstNodeId(null);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                editorAction === 'add_corner'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>➕ Agregar Esquina (Clic en Mapa)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorAction('connect_corners');
                setConnectFirstNodeId(null);
                setDeleteFirstNodeId(null);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                editorAction === 'connect_corners'
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>
                🔗 Conectar 2 Esquinas
                {connectFirstNodeId !== null ? ` (Origen: Esq. #${connectFirstNodeId})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorAction('delete_edge');
                setConnectFirstNodeId(null);
                setDeleteFirstNodeId(null);
              }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                editorAction === 'delete_edge'
                  ? 'bg-rose-500 text-white font-bold shadow'
                  : 'bg-slate-800 text-rose-300 hover:text-rose-100 hover:bg-rose-950/40'
              }`}
              title="Elimina una arista haciendo clic directamente en la calle sobre el mapa o seleccionando dos esquinas consecutivas"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                ✂️ Eliminar Arista
                {deleteFirstNodeId !== null ? ` (1ra: Esq. #${deleteFirstNodeId})` : ''}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {setPlaceLinkMode && (
              <button
                type="button"
                onClick={() =>
                  setPlaceLinkMode((prev) => (prev === 'nearest' ? 'quad' : 'nearest'))
                }
                className="rounded-lg border border-amber-400/50 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-slate-800 cursor-pointer"
              >
                {placeLinkMode === 'nearest'
                  ? '📐 Vínculo Lugar: 1 Esquina Más Cercana'
                  : '📐 Vínculo Lugar: 4 Esquinas de la Cuadra'}
              </button>
            )}
            <span className="text-[11px] text-amber-200/90">
              {editorAction === 'drag'
                ? 'Arrastra cualquier esquina (⚪) en Google Maps para calibrar su posición exacta.'
                : editorAction === 'add_corner'
                ? `Haz clic en cualquier intersección del mapa para crear una esquina conectada a Esq. #${source}.`
                : editorAction === 'connect_corners'
                ? 'Haz clic en la 1ra esquina y luego en la 2da esquina para crear un tramo vial.'
                : 'Haz clic en la línea de cualquier calle para eliminarla, o selecciona 2 esquinas consecutivas.'}
            </span>
          </div>
        </div>
      )}

      {/* Lienzo Principal: Google Maps Real o Esquema de Grafo Didáctico */}
      <div className={`relative ${mapHeightClass} w-full bg-slate-950`}>
        {mapViewMode === 'google' && !mapsError ? (
          <div ref={mapContainerRef} className="h-full w-full" />
        ) : (
          <svg viewBox="0 0 960 560" className="h-full w-full bg-slate-950 select-none">
            <defs>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
              </marker>
              <marker
                id="arrow-normal"
                viewBox="0 0 10 10"
                refX="19"
                refY="5"
                markerWidth="4.5"
                markerHeight="4.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Aristas */}
            {edges.map((edge) => {
              const p1 = svgCoords.get(edge.from);
              const p2 = svgCoords.get(edge.to);
              if (!p1 || !p2) return null;
              const hiveInfo = hiveEdgeColors.get(edge.id);
              const isPrimary = !hasHiveRoutes && !hiveInfo && activeEdgeSet.has(edge.id);
              const isMst = showMstOverlay && mstEdgeSet.has(edge.id);
              const color = hiveInfo
                ? hiveInfo.color
                : isPrimary
                ? '#38bdf8'
                : isMst
                ? '#facc15'
                : getEdgeColor(edge, transportMode);
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;

              return (
                <g
                  key={edge.id}
                  onClick={async () => {
                    if (editorMode && editorAction === 'delete_edge') {
                      await handleDeleteEdge(edge.id);
                      return;
                    }
                    onToggleEdgeClosure(edge.id);
                  }}
                  onMouseEnter={() =>
                    setHoveredItem({
                      type: 'edge',
                      data: edge,
                      fromName: nodeMap.get(edge.from)?.name,
                      toName: nodeMap.get(edge.to)?.name,
                      isDeleteTarget: editorMode && editorAction === 'delete_edge'
                    })
                  }
                  className="cursor-pointer group"
                >
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={color}
                    strokeWidth={isPrimary ? 4.5 : isMst ? 3.5 : 2.2}
                    strokeDasharray={edge.is_closed ? '6,5' : undefined}
                    strokeOpacity={edge.is_closed ? 0.45 : 0.9}
                    markerEnd={
                      edge.is_directed && transportMode === 'car'
                        ? isPrimary
                          ? 'url(#arrow-active)'
                          : 'url(#arrow-normal)'
                        : undefined
                    }
                  />
                  <rect
                    x={midX - 18}
                    y={midY - 8}
                    width="36"
                    height="15"
                    rx="4"
                    fill="#0f172a"
                    stroke={color}
                    strokeWidth="0.8"
                    opacity="0.9"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill={edge.hive_bonus < 0 ? '#e879f9' : '#e2e8f0'}
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    {edge.is_closed ? 'CERRADA' : `${Math.round(edge.effective_time_sec)}s`}
                  </text>
                </g>
              );
            })}

            {/* Líneas Punteadas Lugar ⇢ Esquina en vista SVG */}
            {placeConnectorLines.map((dLine) => {
              const p1 = svgPlaceCoords.get(dLine.placeId);
              const p2 = svgCoords.get(dLine.nodeId);
              if (!p1 || !p2) return null;
              return (
                <line
                  key={`svg-dash-${dLine.id}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={dLine.color}
                  strokeWidth={dLine.isActiveEndpoint ? 2.6 : 1.5}
                  strokeDasharray="5,4"
                  strokeOpacity={dLine.opacity}
                />
              );
            })}

            {/* Esquinas Viales (Nodos) en vista SVG */}
            {nodes.map((node) => {
              const pt = svgCoords.get(node.id);
              if (!pt) return null;
              const isSource = node.id === source;
              const isTarget = node.id === target;
              const isRouteNode = !hasHiveRoutes && activeRouteNodes.includes(node.id);
              const isConnectFirst = editorMode && editorAction === 'connect_corners' && connectFirstNodeId === node.id;
              const isDeleteFirst = editorMode && editorAction === 'delete_edge' && deleteFirstNodeId === node.id;

              const fill = isSource
                ? '#10b981'
                : isTarget
                ? '#f43f5e'
                : isConnectFirst
                ? '#facc15'
                : isDeleteFirst
                ? '#f43f5e'
                : isRouteNode
                ? '#0284c7'
                : '#334155';

              const r = isSource || isTarget || isConnectFirst || isDeleteFirst ? 10 : isRouteNode ? 7.5 : 4.5;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={async () => {
                    if (editorMode && editorAction === 'connect_corners') {
                      if (connectFirstNodeId === null) {
                        setConnectFirstNodeId(node.id);
                        if (showToast) showToast(`🔗 Esquina #${node.id} seleccionada. Ahora haz clic en la 2da esquina.`);
                      } else if (connectFirstNodeId === node.id) {
                        setConnectFirstNodeId(null);
                      } else {
                        try {
                          const res = await api.createStreetEdge({
                            from: connectFirstNodeId,
                            to: node.id,
                            street_name: `Tramo Esq. #${connectFirstNodeId} - Esq. #${node.id}`,
                            is_directed: false
                          });
                          setConnectFirstNodeId(null);
                          if (showToast && res.message) showToast(res.message);
                          if (onGraphMutated) await onGraphMutated();
                        } catch (err) {
                          setConnectFirstNodeId(null);
                          if (showToast) showToast(`Error al conectar esquinas: ${err.message}`);
                        }
                      }
                      return;
                    }

                    if (editorMode && editorAction === 'delete_edge') {
                      if (deleteFirstNodeId === null) {
                        setDeleteFirstNodeId(node.id);
                        if (showToast) showToast(`✂️ Esquina #${node.id} seleccionada. Haz clic en la 2da esquina para eliminar la vía entre ambas.`);
                      } else if (deleteFirstNodeId === node.id) {
                        setDeleteFirstNodeId(null);
                      } else {
                        await handleDeleteEdgeBetween(deleteFirstNodeId, node.id);
                        setDeleteFirstNodeId(null);
                      }
                      return;
                    }

                    if (selectionClickMode === 'source') {
                      onSelectSource(node.id);
                      setSelectionClickMode('target');
                    } else {
                      onSelectTarget(node.id);
                      setSelectionClickMode('source');
                    }
                  }}
                  onMouseEnter={() => setHoveredItem({ type: 'node', data: node })}
                  className="cursor-pointer"
                >
                  <circle
                    r={r}
                    fill={fill}
                    stroke={isSource || isTarget || isRouteNode || isConnectFirst || isDeleteFirst ? '#f8fafc' : '#64748b'}
                    strokeWidth={isSource || isTarget || isRouteNode || isConnectFirst || isDeleteFirst ? '2' : '1'}
                  />
                  {(isRouteNode || isSource || isTarget || isConnectFirst || isDeleteFirst) && (
                    <text
                      textAnchor="middle"
                      dy="3"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="bold"
                    >
                      {isSource ? 'A' : isTarget ? 'B' : isDeleteFirst ? '✂️' : `${node.id}`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Lugares / Hitos Emblemáticos (Diamantes) en vista SVG */}
            {(showAllPlaces ? places : [sourcePlace, targetPlace].filter(Boolean)).map((place) => {
              if (!place) return null;
              const pt = svgPlaceCoords.get(place.id);
              if (!pt) return null;
              const isSrcPlace = sourcePlace && place.id === sourcePlace.id;
              const isDstPlace = targetPlace && place.id === targetPlace.id;
              const fill = isSrcPlace ? '#10b981' : isDstPlace ? '#f43f5e' : '#f59e0b';

              return (
                <g
                  key={`svg-place-${place.id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => {
                    if (!onSelectPlace) return;
                    if (selectionClickMode === 'source') {
                      onSelectPlace(place.id, 'source');
                      setSelectionClickMode('target');
                    } else {
                      onSelectPlace(place.id, 'target');
                      setSelectionClickMode('source');
                    }
                  }}
                  onMouseEnter={() => setHoveredItem({ type: 'place', data: place })}
                  className="cursor-pointer"
                >
                  <polygon
                    points="0,-9 8,0 0,9 -8,0"
                    fill={fill}
                    stroke="#0f172a"
                    strokeWidth="1.8"
                  />
                  <text
                    textAnchor="middle"
                    dy="-12"
                    fill={isSrcPlace ? '#6ee7b7' : isDstPlace ? '#fda4af' : '#fde68a'}
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    📍 {place.name.split('(')[0].slice(0, 18)}
                  </text>
                </g>
              );
            })}

            {/* Vehículos Simulados en Tiempo Real en SVG */}
            {simulatedVehicles.map((v) => {
              if (!v.svg || !v.hasDeparted) return null;
              return (
                <g
                  key={`sim-veh-${v.id}`}
                  transform={`translate(${v.svg.x}, ${v.svg.y})`}
                  className="pointer-events-none transition-all"
                >
                  <circle
                    r="11"
                    fill={v.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="drop-shadow-lg animate-pulse"
                  />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    {v.id}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Tooltip Flotante de Inspección en Vivo */}
        {hoveredItem && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30 max-w-md rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur">
            {hoveredItem.type === 'edge' ? (
              <div>
                {hoveredItem.isDeleteTarget && (
                  <div className="mb-2 rounded bg-rose-500/25 border border-rose-500/50 px-2 py-1 text-[11px] font-bold text-rose-200 flex items-center gap-1.5 animate-pulse">
                    <Trash2 className="h-3.5 w-3.5 text-rose-300" />
                    <span>Haz clic para ELIMINAR esta arista permanentemente</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 font-bold text-white">
                  <span>🛣️ {hoveredItem.data.street_name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      hoveredItem.data.is_closed
                        ? 'bg-rose-500/20 text-rose-300'
                        : hoveredItem.data.hive_bonus < 0
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {hoveredItem.data.is_closed
                      ? 'CERRADA'
                      : hoveredItem.data.hive_bonus < 0
                      ? 'BONIFICADA'
                      : 'HABILITADA'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  De: <strong>{hoveredItem.fromName}</strong> ➔ A:{' '}
                  <strong>{hoveredItem.toName}</strong>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Distancia</span>
                    <strong className="text-slate-100">{hoveredItem.data.distance_m} m</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tiempo Base</span>
                    <strong className="text-slate-100">
                      {hoveredItem.data.base_time_sec} s
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Ocupación</span>
                    <strong
                      className={
                        hoveredItem.data.occupancy_ratio >= 0.85
                          ? 'text-rose-400'
                          : hoveredItem.data.occupancy_ratio >= 0.5
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {hoveredItem.data.current_vehicles}/{hoveredItem.data.max_vehicles} veh (
                      {Math.round(hoveredItem.data.occupancy_ratio * 100)}%)
                    </strong>
                  </div>
                </div>
              </div>
              ) : hoveredItem.type === 'place' ? (
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200 text-[10px]">
                    📍 LUGAR #{hoveredItem.data.id}
                  </span>
                  <span className="text-white">{hoveredItem.data.name}</span>
                </div>
                <div className="text-[11px] text-emerald-300 mt-1 font-medium">
                  ⇢ Línea Punteada a <strong>Esquina #{hoveredItem.data.nearest_node_id}</strong> ({hoveredItem.data.nearest_node_name}) •{' '}
                  <span className="font-mono">+{hoveredItem.data.access_distance_m} m</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  Zona: {hoveredItem.data.zone} • GPS: {hoveredItem.data.lat.toFixed(5)},{' '}
                  {hoveredItem.data.lng.toFixed(5)}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 font-bold text-white">
                  <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300 text-[10px]">
                    ⚪ ESQUINA #{hoveredItem.data.id}
                  </span>
                  <span>{hoveredItem.data.name}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Zona: <strong>{hoveredItem.data.zone}</strong> • Intersección Vial Calibrada
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  GPS: {hoveredItem.data.lat.toFixed(5)}, {hoveredItem.data.lng.toFixed(5)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
