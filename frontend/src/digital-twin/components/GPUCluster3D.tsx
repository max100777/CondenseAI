import { useRef } from 'react';
import { Clone, Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils, Object3D } from 'three';
import { GPUState } from '../../types';
import { GPUUnit3D } from './GPUUnit3D';
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
  useFrame((_,dt) => {
    if (slide.current) slide.current.position.z = MathUtils.damp(slide.current.position.z, extended ? 1.18 : 0, 9, dt);
  });
  return <group position={[0,y,0]}>
    <group ref={slide}>
      <Clone object={model} onClick={event => {event.stopPropagation(); onSelectGPU(gpus[0].gpu_id);}} />
      {gpus.map((gpu,i) => <group key={gpu.gpu_id} position={[i === 0 ? -.44 : .44,.16,0]} scale={.49}>
        <GPUUnit3D position={[0,0,0]} gpu={gpu} isSelected={selectedId===gpu.gpu_id}
          onSelect={onSelectGPU} showLabels={showLabels} showHeatmap={showHeatmap}/>
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
    <Clone object={nodes.Cabinet}/>
    {Array.from({length: Math.ceil(gpuStates.length/2)}, (_,i) => {
      const pair = gpuStates.slice(2*i,2*i+2);
      return <Tray key={i} model={nodes.Tray} y={1.28-i*.62} gpus={pair}
        extended={open && pair.some(g=>g.gpu_id===selection.selectedId)} {...selection}/>;
    })}
    <group ref={hinge} position={[-.98,0,.76]} onClick={e=>{e.stopPropagation(); onOpen();}}>
      <Clone object={nodes.Door}/>
    </group>
    {selection.showLabels && <Html center position={[0,2.2,0]} style={{pointerEvents:'none'}}>
      <span className="whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white">Liquid-cooled GPU rack</span>
    </Html>}
  </group>;
}
