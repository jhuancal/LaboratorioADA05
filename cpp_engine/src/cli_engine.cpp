/**
 * @file cli_engine.cpp
 * @brief Punto de entrada CLI del Motor Algorítmico Nativo en C++20
 *        UNSA - Análisis y Diseño de Algoritmos (Laboratorio 05 - Ejercicios 7, 8 y 9)
 *
 * Compilación:
 *   g++ -O3 -std=c++20 -Iinclude src/cli_engine.cpp -o bin/engine.exe
 */

#include "../include/graph_types.hpp"
#include "../include/algorithms.hpp"
#include "../include/exercises_7_8.hpp"

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <iomanip>

using namespace traffic;

namespace {

std::vector<std::string> split_pipe(const std::string& line) {
    std::vector<std::string> tokens;
    std::stringstream ss(line);
    std::string item;
    while (std::getline(ss, item, '|')) {
        tokens.push_back(item);
    }
    return tokens;
}

bool load_graph_file(
    const std::string& filepath,
    int& num_nodes,
    std::vector<Edge>& edges,
    std::unordered_map<std::string, std::string>& params
) {
    std::ifstream in(filepath);
    if (!in.is_open()) return false;

    num_nodes = 0;
    edges.clear();
    params.clear();

    std::string line;
    while (std::getline(in, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty() || line[0] == '#') continue;

        auto parts = split_pipe(line);
        if (parts.empty()) continue;

        if (parts[0] == "PARAM" && parts.size() >= 3) {
            params[parts[1]] = parts[2];
        } else if (parts[0] == "NODES" && parts.size() >= 2) {
            num_nodes = std::stoi(parts[1]);
        } else if (parts[0] == "EDGE" && parts.size() >= 11) {
            Edge e;
            e.id = std::stoi(parts[1]);
            e.from = std::stoi(parts[2]);
            e.to = std::stoi(parts[3]);
            e.street_name = parts[4];
            e.distance_m = std::stod(parts[5]);
            e.base_time_sec = std::stod(parts[6]);
            e.max_vehicles = std::stoi(parts[7]);
            e.current_vehicles = std::stoi(parts[8]);
            e.is_directed = (std::stoi(parts[9]) != 0);
            e.is_closed = (std::stoi(parts[10]) != 0);
            e.hive_bonus = (parts.size() >= 12) ? std::stod(parts[11]) : 0.0;
            edges.push_back(e);
        }
    }
    return true;
}

} // namespace

int main(int argc, char* argv[]) {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    if (argc < 2) {
        std::cout << "{\"error\":\"Uso: engine.exe <command> [args o archivo_input]\"}\n";
        return 1;
    }

    std::string cmd = argv[1];

    // Modos directos por argumentos para Ejercicio 7 y Ejercicio 8
    if (cmd == "exercise7") {
        int source = (argc >= 3) ? std::stoi(argv[2]) : 0;
        int target = (argc >= 4) ? std::stoi(argv[3]) : 7;
        std::string scenario = (argc >= 5) ? argv[4] : "normal";
        std::cout << run_exercise_7_json(source, target, scenario) << "\n";
        return 0;
    }

    if (cmd == "exercise8") {
        int V = (argc >= 3) ? std::stoi(argv[2]) : 24;
        double density = (argc >= 4) ? std::stod(argv[3]) : 0.25;
        int neg_mode = (argc >= 5) ? std::stoi(argv[4]) : 0;
        bool all_pairs = (argc >= 6) ? (std::stoi(argv[5]) != 0) : true;
        bool closure = (argc >= 7) ? (std::stoi(argv[6]) != 0) : false;
        int source = (argc >= 8) ? std::stoi(argv[7]) : 0;
        int target = (argc >= 9) ? std::stoi(argv[8]) : -1;
        int seed = (argc >= 10) ? std::stoi(argv[9]) : 42;
        bool cached_query = (argc >= 11) ? (std::stoi(argv[10]) != 0) : false;
        std::cout << run_exercise_8_json(V, density, neg_mode, all_pairs, closure, source, target, seed, cached_query) << "\n";
        return 0;
    }

    if (argc < 3) {
        std::cout << "{\"error\":\"Falta ruta del archivo de entrada para el comando " << json_escape(cmd) << "\"}\n";
        return 1;
    }

    int num_nodes = 0;
    std::vector<Edge> edges;
    std::unordered_map<std::string, std::string> params;
    if (!load_graph_file(argv[2], num_nodes, edges, params)) {
        std::cout << "{\"error\":\"No se pudo abrir el archivo de grafo\"}\n";
        return 1;
    }

    std::string mode = params.count("mode") ? params["mode"] : "car";
    int source = params.count("source") ? std::stoi(params["source"]) : 0;
    int target = params.count("target") ? std::stoi(params["target"]) : (num_nodes - 1);
    bool compare_all = params.count("compare_all") ? (params["compare_all"] == "1" || params["compare_all"] == "true") : false;

    // 1. Pre-cálculo completo de Floyd-Warshall para persistir en SQLite
    if (cmd == "floyd_precompute") {
        auto fw = run_floyd_warshall_full(num_nodes, edges, 0, std::max(0, num_nodes - 1), mode, 50);
        std::ostringstream o;
        o << std::fixed << std::setprecision(4);
        o << "{"
          << "\"metrics\":" << metrics_to_json(fw.metrics) << ","
          << "\"num_nodes\":" << num_nodes << ","
          << "\"pairs\":[";
        bool first = true;
        for (int i = 0; i < num_nodes; ++i) {
            for (int j = 0; j < num_nodes; ++j) {
                if (!first) o << ",";
                first = false;
                double d = fw.dist_matrix[i][j];
                o << "{\"u\":" << i << ",\"v\":" << j
                  << ",\"dist\":" << (d >= INF / 2 ? -1.0 : d)
                  << ",\"next_node\":" << fw.next_node[i][j]
                  << ",\"next_edge\":" << fw.next_edge[i][j] << "}";
            }
        }
        o << "]}";
        std::cout << o.str() << "\n";
        return 0;
    }

    // 2. Consulta de Ruta Principal + Comparativa Multi-Algoritmo
    if (cmd == "route_query") {
        bool has_closed = false;
        bool has_negative = false;
        for (const auto& e : edges) {
            if (e.is_closed) has_closed = true;
            if (e.hive_bonus < -1e-6) has_negative = true;
        }

        // Selección inteligente por defecto (Regla de Negocio Ejercicio 8 y 9)
        std::string selected_algo_id;
        std::string smart_banner;
        if (has_negative) {
            selected_algo_id = "bellman_ford";
            smart_banner = "Pesos negativos detectados (Mente Colmena activa) -> Conmutando automáticamente a Bellman-Ford O(V·E).";
        } else if (has_closed) {
            selected_algo_id = "dijkstra_heap";
            smart_banner = "Cierre de vía detectado -> Caché de Floyd-Warshall invalidada (recalcular O(V³) es costoso) -> Conmutando automáticamente a Dijkstra Min-Heap O(E log V).";
        } else if (mode == "pedestrian") {
            selected_algo_id = "dijkstra_heap";
            smart_banner = "Modo Peatonal (Grafo No Dirigido, vías contramano habilitadas) -> Calculando con Dijkstra Min-Heap O(E log V).";
        } else {
            selected_algo_id = "floyd_warshall_cache";
            smart_banner = "Red vial sin cierres ni pesos negativos -> Usando consulta instantánea O(1) desde la Caché SQLite de Floyd-Warshall.";
        }

        auto fw_full = run_floyd_warshall_full(num_nodes, edges, source, target, mode, 80);
        auto fw_cache = run_floyd_warshall_lookup(fw_full, edges, source, target, 5000);
        auto dj_heap = run_dijkstra_heap(num_nodes, edges, source, target, mode, 250);
        auto bf_res = run_bellman_ford(num_nodes, edges, source, target, mode, 200);

        AlgorithmMetrics primary_metrics = fw_cache;
        if (selected_algo_id == "dijkstra_heap") primary_metrics = dj_heap;
        else if (selected_algo_id == "bellman_ford") primary_metrics = bf_res;

        std::ostringstream o;
        o << std::fixed << std::setprecision(4);
        o << "{"
          << "\"selected_algorithm_id\":\"" << json_escape(selected_algo_id) << "\","
          << "\"smart_banner\":\"" << json_escape(smart_banner) << "\","
          << "\"has_closed_edges\":" << (has_closed ? "true" : "false") << ","
          << "\"has_negative_weights\":" << (has_negative ? "true" : "false") << ","
          << "\"compare_all_enabled\":" << (compare_all ? "true" : "false") << ","
          << "\"primary_result\":" << metrics_to_json(primary_metrics);

        if (compare_all) {
            auto dj_mat = run_dijkstra_matrix(num_nodes, edges, source, target, mode, 250);
            auto kr_mst = run_kruskal_mst(num_nodes, edges, source, target, mode, 250);
            auto yen_res = run_yen_hive_mind(num_nodes, edges, source, target, mode, 3, 60, false);

            o << ",\"all_algorithms\":{"
              << "\"floyd_warshall_cache\":" << metrics_to_json(fw_cache) << ","
              << "\"dijkstra_heap\":" << metrics_to_json(dj_heap) << ","
              << "\"dijkstra_matrix\":" << metrics_to_json(dj_mat) << ","
              << "\"bellman_ford\":" << metrics_to_json(bf_res) << ","
              << "\"floyd_warshall_full\":" << metrics_to_json(fw_full.metrics) << ","
              << "\"kruskal_mst\":" << metrics_to_json(kr_mst.metrics) << ","
              << "\"yen_k_shortest\":" << metrics_to_json(yen_res.yen_metrics)
              << "},"
              << "\"mst_backbone_edges\":" << vector_int_to_json(kr_mst.mst_edge_ids) << ","
              << "\"mst_total_cost\":" << kr_mst.mst_total_cost;
        }
        o << "}";
        std::cout << o.str() << "\n";
        return 0;
    }

    // 3. Simulación de Mente Colmena (Yen K-Shortest Paths + Incentivos Negativos + Bellman-Ford)
    if (cmd == "hive_mind") {
        int k_paths = params.count("k_paths") ? std::stoi(params["k_paths"]) : 3;
        int vehicles = params.count("vehicles") ? std::stoi(params["vehicles"]) : 75;
        bool inject_cycle = params.count("inject_cycle") ? (params["inject_cycle"] == "1" || params["inject_cycle"] == "true") : false;

        auto hive = run_yen_hive_mind(num_nodes, edges, source, target, mode, k_paths, vehicles, inject_cycle);
        auto dj_before = run_dijkstra_heap(num_nodes, edges, source, target, mode, 200);
        auto fw_after = run_floyd_warshall_full(num_nodes, hive.updated_edges, source, target, mode, 60);
        auto mst_res = run_kruskal_mst(num_nodes, hive.updated_edges, source, target, mode, 200);

        std::ostringstream o;
        o << std::fixed << std::setprecision(4);
        o << "{"
          << "\"source\":" << source << ","
          << "\"target\":" << target << ","
          << "\"concurrent_vehicles\":" << vehicles << ","
          << "\"inject_negative_cycle\":" << (inject_cycle ? "true" : "false") << ","
          << "\"yen_metrics\":" << metrics_to_json(hive.yen_metrics) << ","
          << "\"bellman_ford_hive\":" << metrics_to_json(hive.bellman_hive_metrics) << ","
          << "\"dijkstra_baseline\":" << metrics_to_json(dj_before) << ","
          << "\"floyd_warshall_after\":" << metrics_to_json(fw_after.metrics) << ","
          << "\"kruskal_mst\":" << metrics_to_json(mst_res.metrics) << ","
          << "\"k_routes\":[";
        for (size_t i = 0; i < hive.k_routes.size(); ++i) {
            if (i > 0) o << ",";
            const auto& r = hive.k_routes[i];
            o << "{"
              << "\"rank\":" << r.rank << ","
              << "\"path_nodes\":" << vector_int_to_json(r.path_nodes) << ","
              << "\"path_edges\":" << vector_int_to_json(r.path_edges) << ","
              << "\"base_cost\":" << r.base_cost << ","
              << "\"effective_cost\":" << r.effective_cost << ","
              << "\"assigned_vehicles\":" << r.assigned_vehicles << ","
              << "\"bottleneck_capacity\":" << r.bottleneck_capacity << ","
              << "\"status_label\":\"" << json_escape(r.status_label) << "\""
              << "}";
        }
        o << "],\"incentives\":[";
        for (size_t i = 0; i < hive.incentives.size(); ++i) {
            if (i > 0) o << ",";
            const auto& inc = hive.incentives[i];
            o << "{"
              << "\"edge_id\":" << inc.edge_id << ","
              << "\"from\":" << inc.from << ","
              << "\"to\":" << inc.to << ","
              << "\"street_name\":\"" << json_escape(inc.street_name) << "\","
              << "\"original_weight\":" << inc.original_weight << ","
              << "\"negative_bonus\":" << inc.negative_bonus << ","
              << "\"final_weight\":" << inc.final_weight << ","
              << "\"reason\":\"" << json_escape(inc.reason) << "\""
              << "}";
        }
        o << "],\"updated_edges\":[";
        for (size_t i = 0; i < hive.updated_edges.size(); ++i) {
            if (i > 0) o << ",";
            const auto& ue = hive.updated_edges[i];
            o << "{"
              << "\"id\":" << ue.id << ","
              << "\"current_vehicles\":" << ue.current_vehicles << ","
              << "\"max_vehicles\":" << ue.max_vehicles << ","
              << "\"hive_bonus\":" << ue.hive_bonus
              << "}";
        }
        o << "]}";
        std::cout << o.str() << "\n";
        return 0;
    }

    // 4. Tour Turístico Multi-Parada (Google Places + C++20)
    if (cmd == "random_tour") {
        std::vector<int> stops;
        if (params.count("stops")) {
            std::stringstream ss(params["stops"]);
            std::string tok;
            while (std::getline(ss, tok, ',')) {
                if (!tok.empty()) stops.push_back(std::stoi(tok));
            }
        }
        if (stops.size() < 2) {
            stops = {0, 2, 3, 5, 1};
        }

        auto t0 = std::chrono::high_resolution_clock::now();
        auto fw = run_floyd_warshall_full(num_nodes, edges, stops[0], stops.back(), mode, 20);
        auto mst = run_kruskal_mst(num_nodes, edges, stops[0], stops.back(), mode, 50);

        // Ordenar paradas usando Vecino Más Cercano sobre la matriz de Floyd-Warshall
        std::vector<int> ordered_stops;
        std::vector<bool> used(stops.size(), false);
        ordered_stops.push_back(stops[0]);
        used[0] = true;

        for (size_t step = 1; step < stops.size(); ++step) {
            int curr = ordered_stops.back();
            int best_idx = -1;
            double best_d = INF;
            for (size_t j = 0; j < stops.size(); ++j) {
                if (!used[j]) {
                    double d = fw.dist_matrix[curr][stops[j]];
                    if (d < best_d) {
                        best_d = d;
                        best_idx = static_cast<int>(j);
                    }
                }
            }
            if (best_idx == -1) {
                for (size_t j = 0; j < stops.size(); ++j) {
                    if (!used[j]) { best_idx = static_cast<int>(j); break; }
                }
            }
            used[best_idx] = true;
            ordered_stops.push_back(stops[best_idx]);
        }

        std::vector<int> full_tour_nodes;
        std::vector<int> full_tour_edges;
        double total_tour_cost = 0.0;
        double total_tour_dist = 0.0;

        for (size_t i = 0; i + 1 < ordered_stops.size(); ++i) {
            int u = ordered_stops[i];
            int v = ordered_stops[i + 1];
            auto seg = run_dijkstra_heap(num_nodes, edges, u, v, mode, 1);
            if (seg.reachable) {
                total_tour_cost += seg.total_cost;
                total_tour_dist += seg.total_distance_m;
                for (size_t k = (i == 0 ? 0 : 1); k < seg.path_nodes.size(); ++k) {
                    full_tour_nodes.push_back(seg.path_nodes[k]);
                }
                for (int eid : seg.path_edges) {
                    full_tour_edges.push_back(eid);
                }
            }
        }
        auto t1 = std::chrono::high_resolution_clock::now();
        double tour_us = std::chrono::duration<double, std::micro>(t1 - t0).count();

        std::ostringstream o;
        o << std::fixed << std::setprecision(4);
        o << "{"
          << "\"ordered_stops\":" << vector_int_to_json(ordered_stops) << ","
          << "\"tour_nodes\":" << vector_int_to_json(full_tour_nodes) << ","
          << "\"tour_edges\":" << vector_int_to_json(full_tour_edges) << ","
          << "\"total_cost_sec\":" << total_tour_cost << ","
          << "\"total_distance_m\":" << total_tour_dist << ","
          << "\"execution_time_us\":" << tour_us << ","
          << "\"mst_backbone_edges\":" << vector_int_to_json(mst.mst_edge_ids) << ","
          << "\"mst_metrics\":" << metrics_to_json(mst.metrics) << ","
          << "\"floyd_metrics\":" << metrics_to_json(fw.metrics)
          << "}";
        std::cout << o.str() << "\n";
        return 0;
    }

    std::cout << "{\"error\":\"Comando no reconocido: " << json_escape(cmd) << "\"}\n";
    return 1;
}
