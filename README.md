# CondensAI — Turning AI's Waste Heat into Clean Water

> An interactive 3D digital twin and engineering simulation platform that captures high-density GPU waste heat from AI data centers and harnesses it to produce clean, drinkable water via Air-Gap Membrane Distillation (AGMD).

---

## Overview

AI data centers running modern GPU clusters (such as NVIDIA H100/H200 accelerators) consume immense electrical power and generate vast amounts of waste heat. Conventional facilities discard this energy into the atmosphere using evaporative cooling towers, consuming millions of liters of municipal freshwater daily.

**CondensAI flips this paradigm.** Instead of wasting energy and drinking water, CondensAI captures the liquid-cooled GPU waste heat ($40^\circ\text{C} - 65^\circ\text{C}$) and routes it to an on-site thermal desalination plant. The system converts seawater, brackish groundwater, or industrial wastewater into ultra-pure freshwater without requiring additional heating electricity.

```
┌───────────────────────────┐      Recovered Heat      ┌─────────────────────────────┐
│ High-Density GPU Cluster  │ ───────────────────────► │ AGMD Desalination Membrane  │
│ 144x Liquid-Cooled GPUs   │                          │ Hydrophobic PTFE Separation │
└─────────────┬─────────────┘                          └──────────────┬──────────────┘
              │ Closed Loop                                           │
              ▼                                                       ▼
  0 Liters Water Consumed                              Clean Drinking Water Produced
```

---

## Core Engineering Concepts

### 1. Direct-to-Chip Liquid Cooling
Rather than relying on inefficient air fans, deionized coolant circulates directly through microchannel copper cold plates clamped onto the GPU silicon die and HBM3 memory packages. This captures over 98% of generated heat at the source and yields higher, more useful coolant temperatures ($38^\circ\text{C} - 45^\circ\text{C}$).

### 2. Physical Fluid Isolation (Zero-Contamination Guarantee)
The primary GPU cooling circuit and the secondary desalination feed water **never touch or mix**. A counterflow plate-and-frame heat exchanger transfers pure thermal energy across titanium plates, ensuring that computer coolant chemicals cannot contaminate the water production loop.

### 3. Air-Gap Membrane Distillation (AGMD)
Membrane distillation is a thermally driven separation process that operates at atmospheric pressure:
- **Warm Feed Channel**: Recovered waste water ($35^\circ\text{C} - 55^\circ\text{C}$) flows along one side of a microporous, hydrophobic (water-repelling) PTFE membrane.
- **Air Gap**: Because the membrane repels liquid, only pure water vapor can cross the microscopic pores into a narrow stagnant air gap. Salts, minerals, heavy metals, and bacteria remain behind.
- **Condensation Plate**: The vapor condenses against a chilled collection plate, trickling into a pure freshwater reservoir while concentrated brine is safely rejected.

### 4. Thermal Buffer Storage
A central insulated $15,000\text{ L}$ thermal buffer tank smooths out the peaks and troughs of bursty AI compute workloads (e.g., training surges vs. idle inference periods), delivering steady, uninterrupted thermal energy to the desalination membranes.

---

## Key Advantages

- **Zero Water-Consumption Cooling**: Traditional evaporative data centers consume up to 9 liters of water per kilowatt-hour of compute. CondensAI's primary loop is 100% closed, eliminating evaporative water loss.
- **Dual Value Creation**: Transforms data centers from single-purpose compute silos into regional utility assets that generate both AI intelligence and municipal drinking water.
- **Low-Grade Heat Utilization**: Unlike traditional distillation methods (MSF, MED) that require steam above $100^\circ\text{C}$, AGMD thrives on low-grade thermal energy ($35^\circ\text{C} - 65^\circ\text{C}$), precisely matching the natural exhaust range of liquid-cooled electronics.
- **Zero Additional Energy for Desalination**: The thermal energy driving evaporation is 100% byproduct heat. Only a negligible fraction of auxiliary pumping electrical power is needed.
- **Superior ESG & WUE Metrics**: Dramatically lowers Data Center Water Usage Effectiveness (WUE) and thermal emissions.

---

## Digital Twin Features

The application provides two complementary visualization experiences sharing a single physical simulation engine:

### 1. Multi-Hall Campus Operations Digital Twin (`/`)
- **Spatial Hierarchy**: 4 Data Halls (Hall A: AI Training, Hall B: AI Inference, Hall C: HPC & Research, Hall D: Experimental) housing 24 server racks, 144 compute sleds, and 144 individual GPUs.
- **Kinematic Retractable GPU Sleds**: Click any server rack or tray to smoothly slide the 4U compute tray forward on telescoping ball-bearing rails. Inspect the CNC copper cold plate, silicon die, 8x HBM3 stacks, quick-disconnect fluid fittings, and 16-phase DrMOS VRM stages.
- **End-to-End Infrastructure Tracing**: Real-time color-coded flow animations tracing:
  - *Primary Coolant Loop* ($1.60\text{ kg/s}$, 28°C supply $\to$ 40.2°C return).
  - *Tier IV 2N Electrical Power* (Independent Feed A & Feed B busways, dual rack PDUs, dual server PSUs).
  - *Spine-and-Leaf Network Fabric* (800G Core Spine $\to$ 400G Leaf $\to$ 200G Server HCAs).
- **Dual Visual Themes**: Cybernetic Dark Mode and industrial daylight Light Mode, persistent in browser storage.
- **144 GPU Explorer**: Filter and sort all accelerators across the entire facility by temperature, electrical power, compute load, or rack ID.

### 2. GPU Thermal Laboratory (`/?lab`)
- Micro-scale single-chip laboratory simulating dynamic transient workloads, junction temperature step responses, and condensation droplet formation.

---

## System Architecture

```
condenseai/
├── backend/                             # FastAPI simulation backend
│   ├── models/                          # Physical models (GPU, Exchanger, Circulation, AGMD)
│   ├── schemas/                         # Pydantic validation schemas
│   ├── services/                        # Numerical integration & orchestration services
│   └── tests/                           # 109 automated pytest verification tests
├── frontend/                            # React 18 + Vite + Three.js application
│   ├── src/
│   │   ├── dcim/                        # Multi-Hall Digital Twin & 3D visualization
│   │   │   ├── FacilityScene3D.tsx      # Three.js WebGL scene & industrial environment
│   │   │   ├── RealisticGpuTray3D.tsx   # Photorealistic hardware & sliding rails
│   │   │   ├── FacilityInfrastructure3D.tsx # 3D fluid, power, and fiber conduits
│   │   │   ├── InspectorPanel.tsx       # Live telemetry HUD & 6-GPU rack dashboard
│   │   │   ├── Console.tsx              # Operations center & theme controller
│   │   │   └── simulation/              # In-browser physics & hydronics engines
│   │   └── digital-twin/                # Single-GPU Thermal Lab components
│   └── scripts/                         # Graph & geometric routing validation CLI tools
```

---

## Getting Started

### Prerequisites
- **Node.js**: v24+ (native TypeScript support)
- **Python**: v3.11+

### Installation & Local Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/max100777/CondenseAI.git
   cd CondenseAI
   ```

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Start the Backend** *(Optional, for single-GPU thermal lab backend simulations)*:
   ```bash
   # From project root
   pip install -r backend/requirements.txt
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

---

## Testing & Quality Assurance

The codebase includes comprehensive automated regression, physics reconciliation, and 3D geometric clearance test suites:

```bash
# Run frontend unit & topology tests (42 passing tests)
npm --prefix frontend test

# Run backend simulation physics tests (109 passing tests)
python -m pytest backend/tests/ -q

# Run production build check
npm --prefix frontend run build

# Run automated graph topology validation
node frontend/scripts/validate-connectivity.mjs

# Run 3D geometric clearance & elevation validation
node frontend/scripts/validate-geometry.mjs
```

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
