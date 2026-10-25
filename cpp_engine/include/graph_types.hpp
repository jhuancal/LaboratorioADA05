#pragma once
/**
 * @file graph_types.hpp
 * @brief Definiciones de estructuras de datos para el Motor Algorítmico C++20
 *        UNSA - Análisis y Diseño de Algoritmos (Laboratorio 05 - Ejercicios 7, 8 y 9)
 */

#include <string>
#include <vector>
#include <limits>
#include <cmath>
#include <sstream>
#include <iomanip>
#include <algorithm>

namespace traffic {

constexpr double INF = 1e15;

struct Node {
    int id = 0;
    std::string name;
    std::string zone;
    std::string category;
    double lat = 0.0;
    double lng = 0.0;
};

struct Edge {
    int id = 0;
    int from = 0;
    int to = 0;
    std::string street_name;
    double distance_m = 100.0;
    double base_time_sec = 10.0;
    int max_vehicles = 100;
    int current_vehicles = 10;
    bool is_directed = true;
    bool is_closed = false;
    double hive_bonus = 0.0; // Puede ser negativo (< 0) cuando la Mente Colmena incentiva desvíos

    /**
     * @brief Calcula el peso efectivo de la arista según el modo de transporte y congestión.
     * En modo "car": aplica penalización cuadrática tipo BPR por congestión vehicular y suma hive_bonus.
     * En modo "pedestrian": usa distancia/tiempo peatonal sin congestión vehicular.
     */
    double effective_weight(const std::string& mode, bool allow_negative = true) const {
        if (is_closed) return INF;
        if (mode == "pedestrian") {
            // Velocidad peatonal promedio ~ 1.35 m/s
            return std::max(1.0, distance_m / 1.35);
        }
        double ratio = (max_vehicles > 0)
            ? static_cast<double>(current_vehicles) / static_cast<double>(max_vehicles)
            : 0.0;
        double congestion_factor = 1.0 + 0.85 * (ratio * ratio);
        double bonus = allow_negative ? hive_bonus : std::max(0.0, hive_bonus);
        double w = base_time_sec * congestion_factor + bonus;
        if (!allow_negative) {
            return std::max(0.5, w);
        }
        return w;
    }

    double occupancy_ratio() const {
        if (max_vehicles <= 0) return 0.0;
        return static_cast<double>(current_vehicles) / static_cast<double>(max_vehicles);
    }
};

struct AlgorithmMetrics {
    std::string algorithm_id;
    std::string algorithm_name;
    std::string complexity_time;
    std::string complexity_space;
    double execution_time_us = 0.0;
    double execution_time_ns = 0.0;
    long long operations_count = 0;
    long long relaxations_count = 0;
    size_t memory_bytes = 0;
    double total_cost = INF;
    double total_distance_m = 0.0;
    bool reachable = false;
    bool negative_cycle_detected = false;
    std::vector<int> path_nodes;
    std::vector<int> path_edges;
    std::vector<int> negative_cycle_nodes;
    std::vector<int> negative_cycle_edges;
    std::string selection_reason;
};

struct MSTResult {
    AlgorithmMetrics metrics;
    double mst_total_cost = 0.0;
    std::vector<int> mst_edge_ids;
};

struct HiveRoutePlan {
    int rank = 1;
    std::vector<int> path_nodes;
    std::vector<int> path_edges;
    double base_cost = 0.0;
    double effective_cost = 0.0;
    int assigned_vehicles = 0;
    int bottleneck_capacity = 0;
    std::string status_label;
};

struct HiveIncentive {
    int edge_id = 0;
    int from = 0;
    int to = 0;
    std::string street_name;
    double original_weight = 0.0;
    double negative_bonus = 0.0;
    double final_weight = 0.0;
    std::string reason;
};

inline std::string json_escape(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        switch (c) {
            case '"': o << "\\\""; break;
            case '\\': o << "\\\\"; break;
            case '\b': o << "\\b"; break;
            case '\f': o << "\\f"; break;
            case '\n': o << "\\n"; break;
            case '\r': o << "\\r"; break;
            case '\t': o << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    o << c;
                }
        }
    }
    return o.str();
}

inline std::string vector_int_to_json(const std::vector<int>& v) {
    std::ostringstream o;
    o << "[";
    for (size_t i = 0; i < v.size(); ++i) {
        if (i > 0) o << ",";
        o << v[i];
    }
    o << "]";
    return o.str();
}

inline std::string metrics_to_json(const AlgorithmMetrics& m) {
    std::ostringstream o;
    o << std::fixed << std::setprecision(4);
    double cost_val = m.total_cost;
    if (std::isinf(cost_val) || std::isnan(cost_val) || cost_val >= INF / 2) {
        cost_val = -1.0;
    }
    o << "{"
      << "\"algorithm_id\":\"" << json_escape(m.algorithm_id) << "\","
      << "\"algorithm_name\":\"" << json_escape(m.algorithm_name) << "\","
      << "\"complexity_time\":\"" << json_escape(m.complexity_time) << "\","
      << "\"complexity_space\":\"" << json_escape(m.complexity_space) << "\","
      << "\"execution_time_us\":" << m.execution_time_us << ","
      << "\"execution_time_ns\":" << m.execution_time_ns << ","
      << "\"operations_count\":" << m.operations_count << ","
      << "\"relaxations_count\":" << m.relaxations_count << ","
      << "\"memory_bytes\":" << m.memory_bytes << ","
      << "\"total_cost\":" << cost_val << ","
      << "\"total_distance_m\":" << m.total_distance_m << ","
      << "\"reachable\":" << (m.reachable ? "true" : "false") << ","
      << "\"negative_cycle_detected\":" << (m.negative_cycle_detected ? "true" : "false") << ","
      << "\"path_nodes\":" << vector_int_to_json(m.path_nodes) << ","
      << "\"path_edges\":" << vector_int_to_json(m.path_edges) << ","
      << "\"negative_cycle_nodes\":" << vector_int_to_json(m.negative_cycle_nodes) << ","
      << "\"negative_cycle_edges\":" << vector_int_to_json(m.negative_cycle_edges) << ","
      << "\"selection_reason\":\"" << json_escape(m.selection_reason) << "\""
      << "}";
    return o.str();
}

} // namespace traffic
