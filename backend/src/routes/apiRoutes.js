/**
 * @file apiRoutes.js
 * @brief Definición de endpoints REST para el sistema de tráfico inteligente de Arequipa
 */
import { Router } from 'express';
import { trafficController } from '../controllers/trafficController.js';

export const apiRouter = Router();

// Grafo y Tráfico (Ejercicio 9)
apiRouter.get('/graph', trafficController.getGraphState);
apiRouter.post('/route', trafficController.calculateRoute);
apiRouter.get('/route', trafficController.calculateRoute);
apiRouter.post('/edges/:id/toggle-closure', trafficController.toggleEdgeClosure);
apiRouter.put('/nodes/:id', trafficController.updateNodePosition);
apiRouter.post('/nodes', trafficController.createCornerNode);
apiRouter.post('/edges', trafficController.createStreetEdge);
apiRouter.delete('/edges/:id', trafficController.deleteStreetEdge);
apiRouter.delete('/edges', trafficController.deleteStreetEdge);
apiRouter.post('/traffic/randomize', trafficController.randomizeTraffic);
apiRouter.post('/traffic/reset', trafficController.resetSystem);

// Mente Colmena Multi-Usuario (Algoritmo de Yen + Pesos Negativos Bellman-Ford)
apiRouter.post('/hive-mind', trafficController.runHiveMind);

// Integración Google Places API (New) v1 + Tour Multi-Parada
apiRouter.post('/places/random-tour', trafficController.getRandomTour);
apiRouter.get('/places/random-tour', trafficController.getRandomTour);
apiRouter.get('/places/status', trafficController.getGoogleApiStatus);

// Laboratorios Académicos Ejercicio 7 y Ejercicio 8
apiRouter.post('/exercises/7', trafficController.runExercise7);
apiRouter.get('/exercises/7', trafficController.runExercise7);
apiRouter.post('/exercises/8', trafficController.runExercise8);
apiRouter.get('/exercises/8', trafficController.runExercise8);
