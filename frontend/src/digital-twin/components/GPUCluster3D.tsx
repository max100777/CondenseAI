import { useRef } from 'react';
import { Clone, Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Object3D } from 'three';
import { GPUState } from '../../types';
import { GraphicsCard } from './GraphicsCard';
import { acceleratorSlot, serviceExtension, slotsPerTray } from '../utils/acceleratorLayout';
import { SPATIAL_LAYOUT } from '../utils/spatialLayout';

interface Props {
  gpuStates: GPUState[];
  open: boolean;
  selectedId: string | null;
  onSelectGPU: (id: string) => void;
  onOpen: () => void;
  showLabels: boolean;
  showHeatmap: boolean;
}

function Tray({model, y, gpus, extended, selectedId, onSelectGPU, showLabels, showHeatmap}:
  Pick<Props,'selectedId'|'onSelectGPU'|'showLabels'|'showHeatmap'> & {
    model: Object3D; y: number; gpus: GPUState[]; extended: boolean;
  }) {
  const slide = useRef<Group>(null);
  const runners = useRef<Group>(null);
  useFrame((_,dt) => {
    if (slide.current) slide.current.position.z = MathUtils.damp(slide.current.position.z, extended ? serviceExtension : 0, 9, dt);
    if (slide.current && runners.current) runners.current.position.z = slide.current.position.z / 2;
  });
  return <group position={[0,y,0]}>
    <group ref={runners}>
      {[-.9,.9].map(x => <mesh key={x} position={[x,-.026,0]} castShadow>
        <boxGeometry args={[.04,.055,1.48]} />
        <meshStandardMaterial color="#9aa8b0" metalness={.76} roughness={.34} />
      </mesh>)}
    </group>
    <group ref={slide}>
      <Clone object={model} castShadow receiveShadow onClick={event => {event.stopPropagation(); onSelectGPU(gpus[0].gpu_id);}} />
      {gpus.map((gpu,i) => <group key={gpu.gpu_id} position={[acceleratorSlot(i).x,.085,acceleratorSlot(i).z]}>
        <GraphicsCard gpu={gpu} left={i % 2 === 0} selected={selectedId===gpu.gpu_id}
          inspect={() => onSelectGPU(gpu.gpu_id)} labels={showLabels} heatmap={showHeatmap}/>
      </group>)}
    </group>
  </group>;
}

export function GPUCluster3D({gpuStates, open, onOpen, ...selection}: Props) {
  const {nodes} = useGLTF('/models/liquid-cooled-rack.glb');
  const hinge = useRef<Group>(null);
  useFrame((_,dt) => {
    if (hinge.current) hinge.current.rotation.y = MathUtils.damp(hinge.current.rotation.y, open ? -1.85 : 0, 8, dt);
  });
  return <group position={SPATIAL_LAYOUT.gpuCluster.position}>
    <Clone object={nodes.Cabinet} castShadow receiveShadow />
    {Array.from({length: Math.ceil(gpuStates.length/slotsPerTray)}, (_,i) => {
      const start = slotsPerTray*i;
      const modules = gpuStates.slice(start,start+slotsPerTray);
      return <Tray key={i} model={nodes.Tray} y={acceleratorSlot(start).trayY} gpus={modules}
        extended={open && modules.some(g=>g.gpu_id===selection.selectedId)} {...selection}/>;
    })}
    <group ref={hinge} position={[-.98,0,.76]} onClick={e=>{e.stopPropagation(); onOpen();}}>
      <Clone object={nodes.Door} castShadow receiveShadow />
    </group>
    {selection.showLabels && <Html center position={[0,2.2,0]} style={{pointerEvents:'none'}}>
      <span className="whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white">Liquid-cooled GPU rack</span>
    </Html>}
  </group>;
}
