"""
FastAPI application for CondensAI:
- Module 1: GPU Heat Generation Model
- Module 2: Heat Recovery Exchanger Model
- Module 3: Hot-Water Circulation, Thermal Storage & System Integration

Exposes RESTful endpoints for individual component simulations as well as
the fully-coupled closed-loop system simulation.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas.agmd_schema import (
    AGMDRequest,
    AGMDResetResponse,
    AGMDResponse,
)
from backend.schemas.analytics_schema import (
    AnalyticsCalculationRequest,
    AnalyticsResetResponse,
    AnalyticsResponse,
    AnalyticsSummarySchema,
)
from backend.schemas.circulation_schema import (
    SystemResetResponse,
    SystemSimulationRequest,
    SystemSimulationResponse,
)
from backend.schemas.gpu_schema import (
    GPUSimulationRequest,
    GPUSimulationResponse,
    HealthResponse,
    ResetResponse,
    RootResponse,
)
from backend.schemas.heat_exchanger_schema import (
    HeatExchangerResetResponse,
    HeatExchangerSimulationRequest,
    HeatExchangerSimulationResponse,
)
from backend.schemas.multi_gpu_schema import (
    MultiGPUResetResponse,
    MultiGPUSimulationRequest,
    MultiGPUSimulationResponse,
)
from backend.services.agmd_service import AGMDService
from backend.services.analytics_service import AnalyticsService
from backend.services.circulation_service import CirculationService
from backend.services.heat_exchanger_service import HeatExchangerService
from backend.services.multi_gpu_service import MultiGPUService
from backend.services.simulation_service import GPUSimulationService

# Metadata definition
APP_TITLE = "CondensAI API"
APP_DESCRIPTION = (
    "CondensAI: Turning AI's Wasted Heat into Clean Water.\n\n"
    "Module 1: Physics-based simulation of GPU electrical consumption, heat dissipation to coolant, and transient temperature balance.\n"
    "Module 2: Counterflow heat exchanger transferring thermal energy from primary coolant to secondary circuit via Effectiveness-NTU.\n"
    "Module 3: Integrated closed-loop circulation, primary inventory, secondary storage reservoir, ambient losses, and downstream AGMD thermal demand.\n"
    "Module 4: Air-Gap Membrane Distillation (AGMD) desalination modeling Knudsen + molecular diffusion, thermal polarization, and freshwater production.\n"
    "Module 5: Water production analytics, thermodynamic efficiencies, STEC, and multi-GPU waste-heat scaling."
)
APP_VERSION = "1.4.0"
MODULE_NAME = (
    "Module 1: GPU Thermal, Module 2: Heat Exchanger, Module 3: Circulation System, "
    "Module 4: AGMD Desalination & Module 5: Analytics & Multi-GPU Scaling"
)

# Initialize FastAPI app
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable Cross-Origin Resource Sharing (CORS) for React frontend and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate singleton simulation services
simulation_service = GPUSimulationService()
heat_exchanger_service = HeatExchangerService()
circulation_service = CirculationService()
agmd_service = AGMDService()
analytics_service = AnalyticsService()
multi_gpu_service = MultiGPUService()


@app.get(
    "/",
    response_model=RootResponse,
    summary="Root metadata endpoint",
    tags=["General"],
)
def get_root() -> RootResponse:
    """Return application name, active module, version, and API documentation link."""
    return RootResponse(
        application_name="CondensAI - Turning AI's Wasted Heat into Clean Water",
        module_name=MODULE_NAME,
        api_status="operational",
        version=APP_VERSION,
        documentation_url="/docs",
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check endpoint",
    tags=["General"],
)
def get_health() -> HealthResponse:
    """Verify backend operational status."""
    return HealthResponse(
        status="healthy",
        service="condensai-backend",
        version=APP_VERSION,
    )


# ---------------------------------------------------------------------------
# Module 1 Endpoints: GPU Heat Generation Model
# ---------------------------------------------------------------------------

@app.post(
    "/api/gpu/simulate",
    response_model=GPUSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run GPU thermal simulation",
    tags=["GPU Thermal Simulation (Module 1)"],
)
def simulate_gpu(request: GPUSimulationRequest) -> GPUSimulationResponse:
    """Execute a deterministic GPU thermal simulation based on the lumped capacitance model."""
    try:
        return simulation_service.run_simulation(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid simulation parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected simulation error: {str(e)}",
        ) from e


@app.post(
    "/api/gpu/reset",
    response_model=ResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset GPU simulation state",
    tags=["GPU Thermal Simulation (Module 1)"],
)
def reset_gpu_simulation() -> ResetResponse:
    """Reset the GPU simulation state back to default initial conditions (time t=0)."""
    try:
        return simulation_service.reset_simulation()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset simulation: {str(e)}",
        ) from e


# ---------------------------------------------------------------------------
# Module 2 Endpoints: Heat Recovery Exchanger Model
# ---------------------------------------------------------------------------

@app.post(
    "/api/heat-exchanger/simulate",
    response_model=HeatExchangerSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run counterflow heat exchanger simulation",
    tags=["Heat Recovery Exchanger (Module 2)"],
)
def simulate_heat_exchanger(
    request: HeatExchangerSimulationRequest,
) -> HeatExchangerSimulationResponse:
    """Execute a counterflow heat exchanger simulation using the Effectiveness-NTU method."""
    try:
        return heat_exchanger_service.run_simulation(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid heat exchanger parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected heat exchanger simulation error: {str(e)}",
        ) from e


@app.post(
    "/api/heat-exchanger/reset",
    response_model=HeatExchangerResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset heat exchanger simulation state",
    tags=["Heat Recovery Exchanger (Module 2)"],
)
def reset_heat_exchanger() -> HeatExchangerResetResponse:
    """Reset the heat exchanger simulation state back to time t=0 and zero energy."""
    try:
        return heat_exchanger_service.reset_simulation()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset heat exchanger: {str(e)}",
        ) from e


# ---------------------------------------------------------------------------
# Module 3 Endpoints: Integrated System Simulation
# ---------------------------------------------------------------------------

@app.post(
    "/api/system/simulate",
    response_model=SystemSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run integrated closed-loop system simulation",
    tags=["Integrated System Simulation (Module 3)"],
)
def simulate_system(request: SystemSimulationRequest) -> SystemSimulationResponse:
    """
    Execute a closed-loop integrated thermal simulation across all circuits:
    - GPU heat generation and dissipation to primary coolant (Module 1).
    - Primary coolant inventory thermal balance and ambient heat losses.
    - Counterflow plate heat exchanger recovery (Module 2).
    - Secondary water reservoir thermal storage and ambient heat losses.
    - Downstream AGMD thermal demand extraction with minimum temperature protection.
    - First-Law system energy conservation verification.
    """
    try:
        return circulation_service.run_simulation(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid system simulation parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected system simulation error: {str(e)}",
        ) from e


@app.post(
    "/api/system/reset",
    response_model=SystemResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset integrated system simulation state",
    tags=["Integrated System Simulation (Module 3)"],
)
def reset_system() -> SystemResetResponse:
    """Reset the integrated system simulation state back to initial conditions and time t=0."""
    try:
        return circulation_service.reset_simulation()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset system simulation: {str(e)}",
        ) from e


# ---------------------------------------------------------------------------
# Module 4 Endpoints: AGMD Desalination Model
# ---------------------------------------------------------------------------

@app.post(
    "/api/agmd/simulate",
    response_model=AGMDResponse,
    status_code=status.HTTP_200_OK,
    summary="Run AGMD desalination simulation",
    tags=["AGMD Desalination (Module 4)"],
)
def simulate_agmd(request: AGMDRequest) -> AGMDResponse:
    """
    Execute an Air-Gap Membrane Distillation (AGMD) desalination simulation:
    - Vapor pressure calculation via Antoine equation with salinity depression.
    - Knudsen and molecular diffusion through porous PTFE membrane.
    - Molecular diffusion across stagnant air gap.
    - Thermal polarization and iterative surface temperature determination.
    - Water permeate flux, freshwater production, and feed inventory concentration.
    """
    try:
        return agmd_service.run_simulation(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid AGMD simulation parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected AGMD simulation error: {str(e)}",
        ) from e


@app.post(
    "/api/agmd/reset",
    response_model=AGMDResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset AGMD simulation state",
    tags=["AGMD Desalination (Module 4)"],
)
def reset_agmd() -> AGMDResetResponse:
    """Reset the AGMD simulation state back to time t=0 and initial feed inventory."""
    try:
        return agmd_service.reset_simulation()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset AGMD simulation: {str(e)}",
        ) from e


# ---------------------------------------------------------------------------
# Module 5 Endpoints: Water Production Analytics & Performance
# ---------------------------------------------------------------------------

@app.post(
    "/api/analytics/calculate",
    response_model=AnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate water production and thermal performance analytics",
    tags=["Water Production Analytics (Module 5)"],
)
def calculate_analytics(request: AnalyticsCalculationRequest) -> AnalyticsResponse:
    """
    Compute comprehensive water production and thermal performance analytics:
    - Instantaneous and cumulative freshwater production rates and yields.
    - Time-weighted average, maximum, and minimum membrane flux (LMH).
    - Exchanger heat recovery, utilization, and GPU-to-AGMD conversion efficiencies.
    - Specific Thermal Energy Consumption (STEC in kWh_th/m³).
    - Feedwater recovery ratio (%).
    """
    try:
        return analytics_service.calculate_from_request(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid analytics parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected analytics calculation error: {str(e)}",
        ) from e


@app.get(
    "/api/analytics/summary",
    response_model=AnalyticsSummarySchema,
    status_code=status.HTTP_200_OK,
    summary="Get active session analytics summary",
    tags=["Water Production Analytics (Module 5)"],
)
def get_analytics_summary() -> AnalyticsSummarySchema:
    """Retrieve the latest evaluated analytics summary for the active session."""
    latest = analytics_service.latest_response
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active analytics calculation found. Execute a simulation or POST /api/analytics/calculate first.",
        )
    return latest.summary


@app.post(
    "/api/analytics/reset",
    response_model=AnalyticsResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset analytics engine state",
    tags=["Water Production Analytics (Module 5)"],
)
def reset_analytics() -> AnalyticsResetResponse:
    """Reset the analytics engine cache and session state."""
    try:
        return analytics_service.reset_analytics()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset analytics: {str(e)}",
        ) from e


# ---------------------------------------------------------------------------
# Module 5 Endpoints: Multi-GPU Scaling & Thermal Simulation
# ---------------------------------------------------------------------------

@app.post(
    "/api/multi-gpu/simulate",
    response_model=MultiGPUSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run multi-GPU integrated waste-heat simulation",
    tags=["Multi-GPU Scaling (Module 5)"],
)
def simulate_multi_gpu(request: MultiGPUSimulationRequest) -> MultiGPUSimulationResponse:
    """
    Execute an integrated thermal simulation of N GPUs sharing a primary coolant loop:
    - Independent transient thermal state tracking for each GPU die.
    - Aggregate electrical power, heat generation, and dissipation into coolant.
    - Counterflow plate heat exchanger waste-heat extraction (Module 2).
    - Secondary water reservoir thermal storage and ambient losses (Module 3).
    - Optional coupled AGMD desalination with dynamic power throttling (Module 4).
    - Automated Module 5 water production and thermal efficiency analytics.
    - First-Law First Principle energy conservation validation across all N GPUs and circuits.
    """
    try:
        return multi_gpu_service.run_simulation(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid multi-GPU parameter: {str(e)}",
        ) from e
    except FloatingPointError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Numerical computation error: {str(e)}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected multi-GPU simulation error: {str(e)}",
        ) from e


@app.post(
    "/api/multi-gpu/reset",
    response_model=MultiGPUResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset multi-GPU simulation state",
    tags=["Multi-GPU Scaling (Module 5)"],
)
def reset_multi_gpu() -> MultiGPUResetResponse:
    """Reset the multi-GPU simulation state back to default initial conditions."""
    try:
        return multi_gpu_service.reset_simulation()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset multi-GPU simulation: {str(e)}",
        ) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
