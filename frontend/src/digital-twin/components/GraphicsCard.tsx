import { Clone, Html, useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { GPUState } from '../../types';
import { getTemperatureColor } from '../utils/temperatureColor';

export function GraphicsCard({gpu, selected, labels, heatmap, inspect, left}: {
  gpu: GPUState; selected: boolean; labels: boolean; heatmap: boolean; inspect: () => void; left: boolean;
}) {
  const {nodes} = useGLTF('/models/liquid-cooled-rack.glb');
  const hoses = useMemo(() => [-1,1].map(side => {
    const header = side * .78 - (left ? -.39 : .39);
    return new CatmullRomCurve3([
      new Vector3(side*.09,.092,side*.055), new Vector3(side*.12,.19,side*.065),
      new Vector3(header*.75,.17,side*.07), new Vector3(header,.035,side*.07),
    ]);
  }),[left]);
  return <group onClick={event => {event.stopPropagation(); inspect();}}>
    <Clone object={nodes.Accelerator} castShadow receiveShadow />
    {hoses.map((curve,i) => <group key={i}>
      <mesh castShadow><tubeGeometry args={[curve,16,.015,8,false]}/>
        <meshStandardMaterial color="#28363c" roughness={.68}/></mesh>
      <mesh position={[i ? .09 : -.09,.093,i ? .055 : -.055]}>
        <cylinderGeometry args={[.025,.025,.033,6]}/><meshStandardMaterial color={i ? '#b87054' : '#4488a7'} metalness={.7}/>
      </mesh>
    </group>)}
    {(selected || heatmap) && <mesh position={[0,.087,0]}>
      <boxGeometry args={[.15,.006,.083]} />
      <meshBasicMaterial color={heatmap ? getTemperatureColor(gpu.current_temp_c) : '#56d6e8'} />
    </mesh>}
    {labels && <Html center position={[0,.24,0]} style={{pointerEvents:'none'}}>
      <span className="whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white">{gpu.gpu_id} · {gpu.current_temp_c.toFixed(1)} °C</span>
    </Html>}
  </group>;
}
