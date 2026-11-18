# HYPERSCALE DCIM

The default workspace opens the campus operations console. It includes eight data halls, 1,280 selectable racks, 17,920 installed devices, simulated cooling and electrical scenarios, local capacity plans and downloadable reports. The original CondensAI GPU thermal lab is accessible from the console header or at `/?lab`.

## Run locally

Use Node 24 and npm. From `frontend`, run `npm ci` and `npm run dev`, then open the local URL printed by Vite (normally port 3000). The campus simulation runs in the browser. To use the thermal lab, install `backend/requirements.txt` in a Python environment and run `uvicorn backend.main:app --port 8000` from the repository root.

From `frontend`, run `npm test`, `npm run lint` and `npm run build`. For the end-to-end suite install Chromium with `npx playwright install chromium` and run `npm run test:e2e`. For installed Google Chrome use `DCIM_CHROME_CHANNEL=chrome npm run test:e2e`. The suite captures campus and rack screenshots under `frontend/test-results`.

## Campus implementation

| Location under frontend | Responsibility |
| --- | --- |
| src/dcim/model.ts | Stable IDs, device placements, coordinates, deterministic operating state, electrical and thermal calculations |
| src/dcim/FacilityScene.tsx | Instanced campus and hall views, airflow, inlet field, front/rear device inspection |
| src/dcim/Plant.tsx | Selectable electrical intake, generator and chilled-water equipment |
| src/dcim/Console.tsx and Trend.tsx | Operational views, planning, timeline, reports and scenario histories |
| scripts/seed-campus.mjs | Relational SQLite schema and repeatable inventory seed |
| src/dcim/model.test.mjs and e2e/ | Calculation, inventory and browser checks |

Run `npm run seed:campus` to create `frontend/campus.sqlite`, or supply a destination with `npm run seed:campus -- /path/to/file.sqlite`. Hall, row, zone, switch, rack, device and A/B feed records originate from the browser's inventory generator. SQLite is a portable inventory snapshot. The live console stores allocation plans in this browser's local storage.

## Engineering assumptions

- Each device belongs to contiguous rack units. Rack space percentage equals occupied U divided by available U times 100. Cabinet width and depth are 0.6 and 1.2 m. The reference layout has 0.68 m bay pitch and 2.7 m row pitch with alternating rack fronts.
- IT power sums configured device allocations multiplied by scenario demand. At 70% load the reference campus draws 10,752 kW from 15,360 kW allocated. Independent A/B branches normally share demand equally. On A-side loss the surviving branch carries the load. The branch rating is 12 kW. Utility-loss and generator-supplied states are instantaneous assumptions.
- Three-phase line current equals 1000 × kW / (√3 × line-to-line volts × PF). The single-phase calculation omits √3. Apparent kVA equals kW / PF. Default inputs are 415 V and 0.95 PF.
- The campus represents an air-cooled, chilled-water CRAH system. Each rack contributes approximately its IT demand as sensible heat. Air temperature rise in K equals heat in kW divided by mass flow in kg/s and specific heat of 1.006 kJ/(kg·K). Supply defaults to 21 °C at 0.84 kg/s per rack. A 60-second first-order response approaches a recirculation-adjusted equilibrium. A disabled unit uses a 0.12 kg/s residual-flow assumption for the temperature estimate. Humidity is an illustrative temperature-dependent estimate.
- Inlet sensors are simulated. The thermal floor uses inverse squared-distance weighting across the selected hall. The particles illustrate the chosen aisle route. Neither field is a CFD computation.
- Modeled mechanical power equals served sensible load divided by assumed COP 4. Other facility overhead is modeled as 10% of IT power. Normal baseline facility demand is 14,515.2 kW with 3,763.2 kW overhead. Instantaneous PUE proxy equals facility / IT power. A zero IT denominator is reported as unavailable. Cooling tons are IT sensible kW / 3.51685.
- Changing demand, fault or capacity starts a fresh scenario period. Replay regenerates the deterministic state at the requested second. Scenario energy uses simulated duration and power, with trapezoidal integration available for timestamped samples. Forecast energy uses constant facility kW × hours. The baseline gives 348,364.8 kWh/day and 127,153,152 kWh/year. Cost equals kWh × assumed tariff and emissions equal kWh × assumed kg CO₂e/kWh. Values retain floating-point precision internally and round only for display.

## Performance and scope

The campus cabinet bodies, front panels and top indicators use three instanced draws for 1,280 racks. The rack explorer renders the selected inventory individually. In a local Node 24 benchmark of 200 samples after one warm-up sample, calculation and aggregation across all racks took 0.073 ms median and 0.269 ms at the 95th percentile. These figures measure the calculation engine only.

The implemented scope is a single-campus deterministic simulator with local allocation/height planning. Multi-site operations, persistent multi-user telemetry streaming, arbitrary topology editing, device installation/removal workflows, validated upstream protection coordination, and collision-aware walkthroughs remain future work. The generator and switch scenarios use simplified transfer and availability rules. The visual/sensor model is schematic and uses representative equipment.

The Sunbird visualization and screenshot pages were consulted for navigation, inspection and monitoring capabilities. The OnRamp video title was accessible, but individual frames were unavailable for inspection. The campus geometry and airflow paths are original.

## CondensAI thermal lab

CondensAI is a physics-based digital twin that models the recovery of thermal waste heat generated by high-density AI data center GPUs and harnesses that recovered heat to power an Air-Gap Membrane Distillation (AGMD) desalination process to produce clean, drinkable water.

---

## 1. Integrated System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HETEROGENEOUS GPU CLUSTER ARRAY                      │
│                               (Module 5)                               │
│   GPU-1 (350 W)  GPU-2 (350 W)  GPU-3 (250 W)  GPU-4 (250 W) ...       │
│   Aggregate Heat Generated: Q_gen,total = sum(Q_gen,i)                 │
│   Aggregate Heat to Coolant: Q_coolant,total = sum(Q_coolant,i)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Q_coolant,total (Heat to Coolant)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PRIMARY COOLANT CIRCUIT (LOOP 1)                    │
│                               (Module 3)                               │
│   Inventory Mass m_p = 2.0 kg | Mass Flow m_dot_p = 0.05 kg/s          │
│   Primary Loop Energy Balance: m_p*Cp*(dT_p/dt) = Q_cool,tot - Q_HX - Q_loss
└───────────────┬────────────────────────────────────────▲───────────────┘
                │ Primary In (T_p)                       │ Primary Out (T_h,out)
                ▼                                        │
┌────────────────────────────────────────────────────────┴───────────────┐
│              COUNTERFLOW HEAT RECOVERY EXCHANGER                       │
│                               (Module 2)                               │
│   Effectiveness-NTU Method (epsilon = 0.763, UA = 150 W/K)             │
│   Physical Isolation: Primary Coolant & Secondary Feed NEVER Mix       │
└───────────────┬────────────────────────────────────────▲───────────────┘
                │ Secondary Out (T_c,out)                │ Secondary In (T_s)
                ▼                                        │
┌────────────────────────────────────────────────────────┴───────────────┐
│               SECONDARY WATER STORAGE RESERVOIR                        │
│                               (Module 3)                               │
│   Storage Mass m_s = 20.0 kg | Circulation Flow m_dot_s = 0.02 kg/s    │
│   Reservoir Energy Balance: m_s*Cp*(dT_s/dt) = Q_HX - Q_AGMD - Q_loss  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Q_AGMD (Thermal Delivery at T_s)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 AGMD DESALINATION MEMBRANE MODULE                      │
│                               (Module 4)                               │
│   Hydrophobic PTFE Membrane (0.22 µm pore, 100 µm thick, 70% porosity) │
│   Stagnant Air Gap (3 mm) ──► Cold Condensing Plate (20-25°C)          │
│   Knudsen + Molecular Vapor Diffusion ──► Clean Freshwater Permeate    │
│   Feed Water Mass Depletion & Salt Conservation: dm_feed/dt = -J*A     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Permeate Distillate & Thermal Streams
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               WATER PRODUCTION & THERMAL ANALYTICS                     │
│                               (Module 5)                               │
│   - Instantaneous & Cumulative Freshwater Yield (mL, L, L/h)           │
│   - Time-Weighted Average, Peak & Minimum Membrane Flux (LMH)          │
│   - Exchanger Recovery (eta_HX), Utilization (eta_util), and           │
│     Overall GPU-to-AGMD Conversion Efficiencies (eta_GPU->AGMD)        │
│   - Specific Thermal Energy Consumption (STEC in kWh_th/m³)            │
│   - Feedwater Recovery Ratio (m_water / m_feed * 100%)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical Models by Module

### Module 1: GPU Heat Generation Model
- **Heat Generation**:
  $$\dot{Q}_{\text{generated}} = P_{\text{GPU}} \times f_{\text{heat}}$$
- **Dissipation to Primary Coolant**:
  $$\dot{Q}_{\text{coolant}} = \max\left(0, \frac{T_{\text{GPU}} - T_p}{R_{\text{th}}}\right)$$
- **GPU Transient Temperature Evolution**:
  $$T_{\text{GPU}}(t + \Delta t) = T_{\text{GPU}}(t) + \left(\frac{\dot{Q}_{\text{generated}} - \dot{Q}_{\text{coolant}}}{C_{\text{th}}}\right) \Delta t$$

### Module 2: Heat Recovery Exchanger Model
- **Counterflow Heat Capacity Rates**:
  $$C_h = \dot{m}_p C_{p,p}, \quad C_c = \dot{m}_s C_{p,s}, \quad C_{\min} = \min(C_h, C_c), \quad C_r = \frac{C_{\min}}{C_{\max}}$$
- **Number of Transfer Units (NTU) & Effectiveness ($\epsilon$)**:
  $$\text{NTU} = \frac{UA}{C_{\min}}, \quad \epsilon = \frac{1 - e^{-\text{NTU}(1 - C_r)}}{1 - C_r e^{-\text{NTU}(1 - C_r)}} \quad (C_r < 1)$$
  $$\epsilon = \frac{\text{NTU}}{1 + \text{NTU}} \quad (C_r \approx 1)$$
- **Thermal Heat Recovery Rate**:
  $$Q_{\text{HX}} = \epsilon \times C_{\min} \times \max(0, T_p - T_s)$$
  $$T_{h,out} = T_p - \frac{Q_{\text{HX}}}{C_h}, \quad T_{c,out} = T_s + \frac{Q_{\text{HX}}}{C_c}$$

### Module 3: Hot-Water Circulation, Thermal Storage & System Integration
- **Primary Coolant Inventory Energy Balance**:
  $$m_p C_{p,p} \frac{dT_p}{dt} = Q_{\text{GPU}} - Q_{\text{HX}} - Q_{\text{loss,p}}$$
- **Secondary Thermal Storage Reservoir Energy Balance**:
  $$m_s C_{p,s} \frac{dT_s}{dt} = Q_{\text{HX}} - Q_{\text{AGMD}} - Q_{\text{loss,s}}$$
- **Downstream AGMD Thermal Coupling Interface**:
  $$P_{\text{max,extract}} = \max\left(0, \frac{m_s C_{p,s}(T_s - T_{\text{min,s}})}{\Delta t} + Q_{\text{HX}} - Q_{\text{loss,s}}\right)$$
  $$Q_{\text{AGMD}} = \min(Q_{\text{demand}}, P_{\text{max,extract}})$$
- **First-Law System Energy Balance Audit**:
  $$E_{\text{generated}} = \Delta E_{\text{GPU}} + \Delta E_{\text{primary}} + \Delta E_{\text{secondary}} + E_{\text{AGMD}} + E_{\text{ambient loss}}$$
  $$\text{Residual} \equiv 0.0\text{ Joules (exact conservation)}$$

### Module 4: Air-Gap Membrane Distillation (AGMD) Desalination Model
- **Pure Water Saturation Vapor Pressure (Antoine Equation)**:
  $$P_{\text{sat}}(T) = 133.322 \times 10^{8.07131 - \frac{1730.63}{T + 233.426}} \quad [T \text{ in } ^\circ\text{C}, P \text{ in Pa}]$$
- **Salinity Depression (Raoult's Law & Water Activity)**:
  $$x_{\text{NaCl}} = \frac{S / M_{\text{NaCl}}}{(S / M_{\text{NaCl}}) + ((\rho_{\text{feed}} \times 1000 - S) / M_{\text{water}})}$$
  $$a_w = 1.0 - 0.5 \times x_{\text{NaCl}} - 10.0 \times x_{\text{NaCl}}^2$$
  $$P_v(T, S) = a_w \times P_{\text{sat}}(T)$$
- **Mass Transfer Resistances (Knudsen + Molecular + Air Gap)**:
  $$R_{\text{total}} = R_{\text{membrane}} + R_{\text{air\_gap}}$$
  $$J_m = \frac{P_v(T_{mh}, S) - P_{\text{sat}}(T_{mc})}{R_{\text{total}}} \quad [\text{kg}/(\text{m}^2\cdot\text{s})]$$
- **Iterative Thermal Polarization Solver**:
  $$Q_{\text{hot,conv}} = h_h (T_{\text{feed}} - T_{mh})$$
  $$Q_{\text{membrane}} = J_m \cdot h_{fg}(T_{mh}) + \frac{k_m}{\delta_m} (T_{mh} - T_{mc})$$
  $$Q_{\text{cold,conv}} = h_c (T_{mc} - T_{\text{cold}})$$
  Converged iteratively via damped Newton-Raphson relaxation ($|Q_{\text{hot}} - Q_{\text{cold}}| < 10^{-4}\text{ W}$).

### Module 5: Water Production Analytics & Multi-GPU Scaling

#### Subsystem A: Analytics Engine
- **Instantaneous Production Rates**:
  $$\dot{m}_w = J_m A_m \quad [\text{kg/s}]$$
  $$\dot{V}_w = \frac{\dot{m}_w}{\rho_w} \times 3600 \times 1000 \quad [\text{L/h}]$$
  $$J_{\text{LMH}} = \frac{J_m}{\rho_w} \times 3600 \times 1000 \quad [\text{L}/(\text{m}^2\cdot\text{h})]$$
- **Cumulative Freshwater Integration**:
  $$m_{w,cum} = \sum_{i=1}^n \dot{m}_{w,i} \Delta t_i \quad [\text{kg}], \quad V_{w,cum} = \frac{m_{w,cum}}{\rho_w} \times 1000 \quad [\text{L}], \quad V_{mL} = V_{w,cum} \times 1000 \quad [\text{mL}]$$
- **Time-Weighted Average Flux**:
  $$J_{avg} = \frac{\sum_i J_{LMH,i} \Delta t_i}{\sum_i \Delta t_i} \quad [\text{LMH}]$$
- **Thermodynamic Efficiency Ratios**:
  $$\eta_{\text{HX}} = \left(\frac{E_{\text{HX,recovered}}}{E_{\text{GPU,generated}}}\right) \times 100\%$$
  $$\eta_{\text{utilization}} = \left(\frac{E_{\text{AGMD}}}{E_{\text{HX,recovered}}}\right) \times 100\%$$
  $$\eta_{\text{GPU}\to\text{AGMD}} = \left(\frac{E_{\text{AGMD}}}{E_{\text{GPU,generated}}}\right) \times 100\%$$
- **Specific Thermal Energy Consumption (STEC)**:
  $$\text{STEC} = \frac{E_{\text{AGMD,kWh}}}{V_{\text{water,m}^3}} \quad [\text{kWh}_{th}/\text{m}^3]$$
  *(Safely returns `null` when water volume is zero; zero denominators handled without crashing)*.
- **Feed Water Recovery Ratio**:
  $$\text{Recovery} = \left(\frac{m_{\text{freshwater,produced}}}{m_{\text{initial,feedwater}}}\right) \times 100\%$$

#### Subsystem B: Multi-GPU Waste-Heat Scaling
- **Individual GPU Dynamic States**:
  $$C_{th,i} \frac{dT_{\text{GPU},i}}{dt} = Q_{\text{gen},i} - Q_{\text{coolant},i}$$
- **Aggregate Heat Fluxes**:
  $$Q_{\text{gen,total}} = \sum_{i=1}^N Q_{\text{gen},i}, \quad Q_{\text{coolant,total}} = \sum_{i=1}^N Q_{\text{coolant},i}$$
- **Shared Primary Coolant Loop Energy Balance**:
  $$m_p C_{p,p} \frac{dT_p}{dt} = \sum_{i=1}^N Q_{\text{coolant},i} - Q_{\text{HX}} - Q_{\text{loss,p}}$$
- **Full First-Law System Energy Conservation**:
  $$E_{\text{generated,total}} = \sum_{i=1}^N \Delta E_{\text{GPU},i} + \Delta E_{\text{primary}} + \Delta E_{\text{secondary}} + E_{\text{AGMD}} + E_{\text{ambient loss}}$$
  $$\text{Residual} < 10^{-6}\text{ Joules across all } N \text{ GPUs}.$$

---

## 3. Directory Structure

```
condensai/
├── backend/
│   ├── models/
│   │   ├── __init__.py
│   │   ├── gpu_model.py              # Module 1: GPU lumped capacitance thermal model
│   │   ├── heat_exchanger_model.py   # Module 2: Counterflow effectiveness-NTU exchanger
│   │   ├── circulation_model.py      # Module 3: Closed-loop circulation & reservoir model
│   │   ├── agmd_model.py             # Module 4: AGMD desalination physics model
│   │   ├── analytics_model.py        # Module 5: Water production & thermal analytics model
│   │   └── multi_gpu_model.py        # Module 5: Multi-GPU cluster waste-heat scaling model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── gpu_schema.py             # Module 1 schemas
│   │   ├── heat_exchanger_schema.py  # Module 2 schemas
│   │   ├── circulation_schema.py     # Module 3 schemas
│   │   ├── agmd_schema.py            # Module 4 schemas
│   │   ├── analytics_schema.py       # Module 5 analytics schemas
│   │   └── multi_gpu_schema.py       # Module 5 multi-GPU schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── simulation_service.py     # Module 1 service
│   │   ├── heat_exchanger_service.py # Module 2 service
│   │   ├── circulation_service.py    # Module 3 system service
│   │   ├── agmd_service.py           # Module 4 service
│   │   ├── analytics_service.py      # Module 5 analytics service
│   │   └── multi_gpu_service.py      # Module 5 multi-GPU service
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_gpu_model.py         # 16 tests for Module 1
│   │   ├── test_heat_exchanger.py    # 21 tests for Module 2
│   │   ├── test_circulation.py       # 21 tests for Module 3
│   │   ├── test_agmd.py              # 21 tests for Module 4 (standalone)
│   │   ├── test_agmd_integration.py  # 8 tests for Module 4 (coupled integration)
│   │   ├── test_analytics.py         # 10 tests for Module 5 (analytics KPIs)
│   │   ├── test_multi_gpu.py         # 7 tests for Module 5 (multi-GPU physics)
│   │   └── test_multi_gpu_integration.py # 5 tests for Module 5 (API & scaling)
│   ├── main.py                       # FastAPI application & REST endpoints
│   ├── requirements.txt              # Dependencies
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MultiGPUControlPanel.tsx       # GPU configuration & presets
│   │   │   ├── WaterProductionOverview.tsx   # Yield, flux & permeate KPIs
│   │   │   ├── ThermalEfficiencyDashboard.tsx# Enthalpy pipeline & STEC
│   │   │   ├── GPUComparisonView.tsx          # Multi-node comparison table
│   │   │   ├── TimeSeriesCharts.tsx           # Recharts dynamic time-series
│   │   │   └── ScalingComparisonView.tsx      # 1 vs 2 vs 4 GPU benchmark
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## 4. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root metadata endpoint |
| `GET` | `/health` | Health check endpoint |
| `POST` | `/api/gpu/simulate` | Module 1: GPU lumped-capacitance transient simulation |
| `POST` | `/api/gpu/reset` | Module 1: Reset GPU simulation state |
| `POST` | `/api/heat-exchanger/simulate` | Module 2: Counterflow effectiveness-NTU simulation |
| `POST` | `/api/heat-exchanger/reset` | Module 2: Reset heat exchanger state |
| `POST` | `/api/system/simulate` | Module 3: Single-GPU integrated circulation simulation |
| `POST` | `/api/system/reset` | Module 3: Reset system circulation state |
| `POST` | `/api/agmd/simulate` | Module 4: Standalone AGMD desalination simulation |
| `POST` | `/api/agmd/reset` | Module 4: Reset AGMD simulation state |
| `POST` | `/api/analytics/calculate` | Module 5: Compute water production & thermal KPIs |
| `GET` | `/api/analytics/summary` | Module 5: Retrieve active session analytics summary |
| `POST` | `/api/analytics/reset` | Module 5: Reset analytics engine cache |
| `POST` | `/api/multi-gpu/simulate` | Module 5: Multi-GPU cluster waste-heat simulation |
| `POST` | `/api/multi-gpu/reset` | Module 5: Reset multi-GPU simulation state |

---

## 6. Module 6: Interactive 3D Digital Twin & Real-Time System Visualization

Module 6 transforms CondensAI into an engineering 3D digital twin platform built with React Three Fiber, Three.js, and Tailwind CSS. The 3D model renders the entire thermodynamic flow path and updates dynamically using real physics simulation outputs from the backend engine.

### 3D Physical Spatial Layout & Components:
```
[GPU Cluster Rack] ──(Primary Loop)──► [Counterflow Heat Exchanger] ──(Secondary Loop)──► [Thermal Reservoir]
                                                    │                                            │
                                          (Physical Partition)                            (Hot Feed Pipe)
                                                    │                                            ▼
                                                    ▼                                    [AGMD Module (5 Layers)]
                                            [Zero Mixing Boundary]                               │
                                                                                          (Pure Distillate)
                                                                                                 ▼
                                                                                      [Freshwater Collector]
```

1. **GPU Server Rack Chassis & Cold Plates (`GPUCluster3D` & `GPUUnit3D`)**:
   - Renders 1 to 4 stacked GPU compute nodes with anodized heatsinks, copper microchannel cold plates, and status indicators.
   - Dynamic emissive heat maps driven by individual junction temperatures ($T_j$).
2. **Primary Coolant Loop (`PrimaryCoolantLoop3D`)**:
   - Closed dielectric coolant piping connecting GPU cold plates to the heat exchanger at $0.05\text{ kg/s}$.
   - Shows hot leg ($T_p$) and cooled return leg ($T_{h,out}$).
3. **Counterflow Heat Exchanger (`HeatExchanger3D`)**:
   - Plate pack assembly illustrating countercurrent heat exchange via the Effectiveness–NTU method ($\varepsilon \approx 0.763$).
   - Explicit impervious physical partition guaranteeing zero fluid contamination between primary dielectric coolant and secondary saline water.
4. **Secondary Water Circulation Loop (`SecondaryWaterLoop3D`)**:
   - Saline water piping transferring recovered thermal energy to the storage reservoir at $0.02\text{ kg/s}$.
5. **Secondary Thermal Storage Reservoir (`Reservoir3D`)**:
   - Cylindrical insulated tank showing bulk water temperature ($T_s$), stored thermal enthalpy, and an ambient safety baseline ring at $20.0^\circ\text{C}$.
6. **AGMD Desalination Membrane Module (`AGMDModule3D`)**:
   - 5 physically distinct layers:
     - **Layer 1: Hot Saline Feed Channel** ($T_{\text{feed}}$ entry).
     - **Layer 2: Hydrophobic Microporous Membrane (PTFE)** ($0.22\ \mu\text{m}$ pores, liquid barrier).
     - **Layer 3: Stagnant Air Gap** ($3\text{ mm}$ width) with explanatory vapor diffusion particle markers modulated by vapor flux ($J_m$).
     - **Layer 4: Chilled Condensing Plate** ($T_{\text{cold\_plate}} = 20^\circ\text{C}$) with condensate water film.
     - **Layer 5: Distillate Drainage Trough** routing pure water downward.
   - **Cutaway Inspection Mode**: Toggle between closed protective casing and cross-sectional internal view.
7. **Graduated Freshwater Collector (`FreshwaterCollector3D`)**:
   - Laboratory-grade graduated glass cylinder with dynamic water fill level proportional to actual cumulative distillate yield ($V_L$ / $V_{mL}$) and instantaneous production rate ($L/h$).

### Interactive Telemetry & Controls:
- **Viewpoint Presets**: One-click smooth camera lerp to *Full System Overview*, *GPU Cluster*, *Heat Exchanger*, *Storage Reservoir*, and *AGMD Module*.
- **Display Toggles**: Live 3D engineering labels, continuous thermal gradient heatmap ($20^\circ\text{C}$ Deep Blue $\to 80^\circ\text{C}$ Deep Red), flow animation, and AGMD cutaway.
- **Simulation Time-Scrubber & Playback**: Real-time play/pause with 1x, 2x, and 5x speed multipliers, scrubbing to any simulated second ($t \in [0, t_{\text{end}}]$).
- **Component Inspector**: Slide-over panel displaying real-time telemetry, underlying physical governing equations, and circuit isolation integrity guarantees.
- **Unified Navigation**: Seamless switching between **3D Digital Twin** and **Analytics & Charts** sharing the exact same simulation state with zero redundant network overhead.


The test suite contains **109 passing automated tests** across all 5 modules:

```bash
$ python -m pytest backend/tests/ -v
============================= test session starts =============================
platform win32 -- Python 3.13.15, pytest-8.4.2
collected 109 items

backend/tests/test_agmd.py .....................                         [ 19%]
backend/tests/test_agmd_integration.py ........                          [ 26%]
backend/tests/test_analytics.py ..........                               [ 35%]
backend/tests/test_circulation.py .....................                  [ 55%]
backend/tests/test_gpu_model.py ................                         [ 69%]
backend/tests/test_heat_exchanger.py .....................               [ 88%]
backend/tests/test_multi_gpu.py .......                                  [ 95%]
backend/tests/test_multi_gpu_integration.py .....                        [100%]

======================= 109 passed, 2 warnings in 1.85s =======================
```

### Verification Highlights:
1. **Single-GPU Backward Compatibility**: 1-GPU multi-GPU simulation matches the frozen single-GPU `CirculationModel` within floating-point tolerance ($< 10^{-6}$).
2. **First-Law System Energy Conservation**: Residual remains strictly $< 10^{-6}\text{ J}$ at every time step across 1, 2, and 4 GPU configurations.
3. **Safety Protection**: Secondary reservoir never drops below `min_secondary_temp_c` ($20^\circ\text{C}$).
4. **Clean Division**: All division operations safely check for zero denominators (STEC returns `null` when volume is 0; efficiency denominators guarded).
