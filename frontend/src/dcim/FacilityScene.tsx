import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import {
  Color,
  InstancedMesh,
  Object3D,
  Vector3,
  CurvePath,
  LineCurve3,
} from "three";
import type { Rack, Reading } from "./model";
import { interpolate } from "./model";
import { Plant } from "./Plant";

export type Layer =
  | "Equipment"
  | "Temperature"
  | "Power"
  | "Space"
  | "Humidity"
  | "Network"
  | "Health";
export function tint(r: Rack, s: Reading, layer: Layer) {
  switch (layer) {
    case "Temperature":
      return s.inlet > 27
        ? "#ff5847"
        : s.inlet > 25
          ? "#e99b48"
          : s.inlet < 18
            ? "#419bff"
            : "#4bb89a";
    case "Power":
      return s.kw > 12 ? "#ff5847" : s.kw > 9 ? "#e99b48" : "#409dbc";
    case "Space":
      return r.occupied / r.ru > 0.8 ? "#f0b35c" : "#588baf";
    case "Humidity":
      return s.rh < 35 ? "#dfaa61" : "#568acf";
    case "Network":
      return s.network ? "#4ca8b7" : "#e75345";
    case "Health":
      return s.alert ? "#f27752" : "#50a78c";
    default:
      return ["#415364", "#576779", "#3d646c", "#384e62"][r.index % 4];
  }
}
type Props = {
  racks: Rack[];
  data: Reading[];
  selected: Rack;
  hall: number;
  layer: Layer;
  roof: boolean;
  air: boolean;
  speed: number;
  density: number;
  top: boolean;
  trace: boolean;
  paused: boolean;
  pick: (r: Rack) => void;
  interior: boolean;
  rear: boolean;
  xray: boolean;
  device: number;
  inspect: (i: number) => void;
};
function Fleet({ racks, data, layer, pick, selected }: Props) {
  const shell = useRef<InstancedMesh>(null!),
    vents = useRef<InstancedMesh>(null!),
    led = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    const o = new Object3D();
    racks.forEach((r, i) => {
      const height = r.ru * 0.04445 + 0.15;
      o.position.set(r.x, height / 2, r.z);
      o.scale.set(0.6, height, 1.2);
      o.updateMatrix();
      shell.current.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 4; j++) {
        o.position.set(r.x, 0.24 + j * 0.4, r.z + 0.605 * r.front);
        o.scale.set(0.51, 0.29, 0.016);
        o.updateMatrix();
        vents.current.setMatrixAt(i * 4 + j, o.matrix);
      }
      o.position.set(r.x, height + 0.012, r.z);
      o.scale.set(0.5, 0.025, 0.95);
      o.updateMatrix();
      led.current.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [shell.current, vents.current, led.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [racks]);
  useLayoutEffect(() => {
    const color = new Color();
    racks.forEach((r, i) => {
      shell.current.setColorAt(i, color.set(tint(r, data[r.index], layer)));
      led.current.setColorAt(
        i,
        color.set(
          r.id === selected.id ? "#faf4ad" : tint(r, data[r.index], layer),
        ),
      );
    });
    for (const mesh of [shell.current, led.current])
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [racks, data, layer, selected.id]);
  return (
    <group
      onClick={(e) => {
        if (e.instanceId !== undefined) {
          e.stopPropagation();
          pick(
            racks[
              e.object === vents.current
                ? Math.floor(e.instanceId / 4)
                : e.instanceId
            ],
          );
        }
      }}
    >
      <instancedMesh ref={shell} args={[undefined, undefined, racks.length]}>
        <boxGeometry />
        <meshStandardMaterial metalness={0.35} roughness={0.62} />
      </instancedMesh>
      <instancedMesh
        ref={vents}
        args={[undefined, undefined, racks.length * 4]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#18242b" />
      </instancedMesh>
      <instancedMesh ref={led} args={[undefined, undefined, racks.length]}>
        <boxGeometry />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}
function Air({
  rack,
  speed,
  density,
  paused,
}: {
  rack: Rack;
  speed: number;
  density: number;
  paused: boolean;
}) {
  const ref = useRef<InstancedMesh>(null!),
    phase = useRef(0);
  const path = useMemo(() => {
    const f = rack.front,
      x = rack.x,
      z = rack.z,
      end = rack.hx - 6.5;
    const points = [
      [end, 0.65, z + f * 1.3],
      [x, 0.65, z + f * 1.3],
      [x, 0.9, z + f * 0.6],
      [x, 1.2, z - f * 0.6],
      [x, 2.5, z - f * 1.3],
      [end, 2.5, z - f * 1.3],
      [end, 0.65, z + f * 1.3],
    ].map((p) => new Vector3(...p));
    const c = new CurvePath<Vector3>();
    points.slice(1).forEach((p, i) => c.add(new LineCurve3(points[i], p)));
    return c;
  }, [rack]);
  const scratch = useMemo(
    () => ({ o: new Object3D(), color: new Color() }),
    [],
  );
  useFrame((_, dt) => {
    if (!paused) phase.current += dt * speed * 0.12;
    for (let i = 0; i < density; i++) {
      const p = path.getPointAt((phase.current + i / density) % 1);
      scratch.o.position.copy(p);
      scratch.o.updateMatrix();
      ref.current.setMatrixAt(i, scratch.o.matrix);
      ref.current.setColorAt(
        i,
        scratch.color.set(
          (p.z - rack.z) * rack.front > 0 ? "#46d9fb" : "#ff974e",
        ),
      );
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      frustumCulled={false}
      args={[undefined, undefined, density]}
    >
      <sphereGeometry args={[0.095, 8, 6]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
function Camera({
  hall,
  r,
  top,
  interior,
  rear,
}: {
  hall: number;
  r: Rack;
  top: boolean;
  interior: boolean;
  rear: boolean;
}) {
  const { camera } = useThree();
  const ctrl = useRef<any>(null);
  useEffect(() => {
    const center = new Vector3(hall < 0 ? 0 : r.hx, 0, hall < 0 ? 0 : r.hz);
    const d = hall < 0 ? 58 : 23;
    if (interior) center.set(0, 1, 0);
    camera.position
      .copy(center)
      .add(
        interior
          ? new Vector3(0.8, 0.35, rear ? -3.3 : 3.3)
          : new Vector3(top ? 0 : d * 0.65, top ? d * 1.75 : d, top ? 0.01 : d),
      );
    ctrl.current.target.copy(center);
    ctrl.current.update();
  }, [hall, r.hx, r.hz, top, camera, interior, rear]);
  return (
    <OrbitControls
      ref={ctrl}
      makeDefault
      maxPolarAngle={Math.PI * 0.48}
      minDistance={2}
      maxDistance={190}
    />
  );
}
export default function FacilityScene(
  p: Props & { selectPlant: (id: string) => void },
) {
  const halls = useMemo(
    () => p.racks.filter((r) => r.row === 0 && r.bay === 0),
    [p.racks],
  );
  const field = useMemo(() => {
    if (p.hall < 0 || p.layer !== "Temperature" || p.interior) return [];
    const sensors = p.racks.map((r) => ({
      x: r.x,
      z: r.z + r.front * 0.61,
      value: p.data[r.index].inlet,
    }));
    return Array.from({ length: 50 }, (_, i) => {
      const x = p.selected.hx + ((i % 5) - 2) * 2.4,
        z = p.selected.hz + (Math.floor(i / 5) - 4.5) * 2.7;
      const v = interpolate(x, z, sensors);
      return {
        x,
        z,
        color:
          v > 27
            ? "#ed634c"
            : v > 25
              ? "#d4ac49"
              : v < 18
                ? "#468fdf"
                : "#64bc99",
      };
    });
  }, [
    p.hall,
    p.layer,
    p.interior,
    p.racks,
    p.data,
    p.selected.hx,
    p.selected.hz,
  ]);
  return (
    <Canvas dpr={[1, 1.4]} camera={{ fov: 45, far: 400 }}>
      <color attach="background" args={["#172530"]} />
      <ambientLight intensity={1.6} />
      <directionalLight intensity={2.3} position={[20, 50, 30]} />
      <gridHelper args={[160, 80, "#384955", "#293a46"]} />
      {p.interior ? (
        <group>
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, 1, 0]}>
              <boxGeometry args={[0.022, 2, 1.2]} />
              <meshStandardMaterial
                transparent
                opacity={p.xray ? 0.15 : 1}
                color="#536876"
              />
            </mesh>
          ))}
          {p.selected.devices.map((device, i) => (
            <group
              key={device.id}
              position={[
                0,
                0.08 + (device.start - 1 + device.u / 2) * 0.04445,
                0,
              ]}
              onClick={(e) => {
                e.stopPropagation();
                p.inspect(i);
              }}
            >
              <mesh>
                <boxGeometry args={[0.56, device.u * 0.04445 - 0.005, 1.12]} />
                <meshStandardMaterial
                  color={i === p.device ? "#4ac8ba" : "#586b79"}
                  transparent={p.xray}
                  opacity={p.xray ? 0.55 : 1}
                />
              </mesh>
              {[-0.19, -0.065, 0.065, 0.19].map((x) => (
                <mesh key={x} position={[x, 0, 0.564]}>
                  <boxGeometry args={[0.105, 0.026, 0.008]} />
                  <meshStandardMaterial color="#192229" />
                </mesh>
              ))}
              {[-0.16, 0.16].map((x) => (
                <mesh key={x} position={[x, 0, -0.57]}>
                  <boxGeometry args={[0.1, 0.031, 0.03]} />
                  <meshStandardMaterial color={x < 0 ? "#479ccc" : "#cb8653"} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ) : (
        <>
          {p.hall < 0 && <Plant select={p.selectPlant} />}
          {halls.map((h) => (
            <group key={h.hall} position={[h.hx, 0, h.hz]}>
              <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[15, 0.03, 28]} />
                <meshStandardMaterial color="#70818a" />
              </mesh>
              <mesh position={[0, 0.45, -14]}>
                <boxGeometry args={[15, 0.9, 0.16]} />
                <meshStandardMaterial color="#99aab1" />
              </mesh>
              {Array.from({ length: 5 }, (_, i) => (
                <group key={i} position={[0, 0, -10.8 + i * 5.4]}>
                  <mesh
                    position={[-6.5, 1, 0]}
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = p.racks.find(
                        (r) => r.hall === h.hall && r.row === i * 2,
                      );
                      if (r) p.pick(r);
                    }}
                  >
                    <boxGeometry args={[1.1, 2, 2.2]} />
                    <meshStandardMaterial
                      color={
                        p.data[h.index + i * 32].cooling ? "#408895" : "#ed765b"
                      }
                    />
                  </mesh>
                  <mesh position={[0, 2.55, 0]}>
                    <boxGeometry args={[11, 0.09, 0.23]} />
                    <meshStandardMaterial color="#728692" />
                  </mesh>
                </group>
              ))}
              {p.roof && (
                <mesh position={[0, 3, 0]}>
                  <boxGeometry args={[15, 0.18, 28]} />
                  <meshStandardMaterial
                    color="#759399"
                    transparent
                    opacity={0.55}
                  />
                </mesh>
              )}
            </group>
          ))}
          <Fleet {...p} />
          {field.map(({ x, z, color }) => (
            <mesh
              key={x + "," + z}
              position={[x, 0.038, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[2.4, 2.7]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.42}
                depthWrite={false}
              />
            </mesh>
          ))}
          {p.air && p.data[p.selected.index].airflow > 0 && (
            <Air
              rack={p.selected}
              speed={p.speed}
              density={p.density}
              paused={p.paused}
            />
          )}
          {p.trace &&
            [-1, 1].map((f, i) => (
              <Line
                key={f}
                points={[
                  [p.selected.hx + f * 7, 0.4, p.selected.hz - 14],
                  [p.selected.hx + f * 7, 2.8, p.selected.z],
                  [p.selected.x, 2.8, p.selected.z],
                  [p.selected.x, 1, p.selected.z],
                ]}
                color={i ? "#ffa556" : "#54deff"}
                lineWidth={2}
              />
            ))}
        </>
      )}
      <Camera
        hall={p.hall}
        r={p.selected}
        top={p.top}
        interior={p.interior}
        rear={p.rear}
      />
    </Canvas>
  );
}
