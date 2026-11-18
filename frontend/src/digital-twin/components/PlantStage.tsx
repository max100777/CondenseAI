import { Environment, Lightformer } from '@react-three/drei';

const floor = -2.19;

export function PlantStage() {
  return <>
    <color attach="background" args={['#252d34']} />
    <fog attach="fog" args={['#252d34', 22, 52]} />
    <Environment resolution={128} frames={1}>
      <Lightformer position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 5, 1]} intensity={2.5} />
      <Lightformer position={[-7, 3, 4]} target={[0, 0, 0]} scale={[5, 3, 1]} intensity={1.1} />
      <Lightformer position={[5, 3, -5]} target={[0, 0, 0]} scale={[9, 2, 1]} intensity={1.8} />
    </Environment>
    <hemisphereLight args={['#edf4fb', '#73777b', .95]} />
    <directionalLight position={[-4, 8, 5]} intensity={2.1} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9}
      shadow-camera-top={7} shadow-camera-bottom={-6} shadow-normalBias={.035} />
    <directionalLight position={[5, 5, -6]} intensity={1.25} color="#c2d9ec" />

    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, floor, 0]}>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial color="#43494e" roughness={.87} />
    </mesh>
    <mesh position={[0, -2.12, 0]} receiveShadow>
      <boxGeometry args={[13.3, .14, 3.4]} />
      <meshStandardMaterial color="#30383f" roughness={.76} />
    </mesh>
    {[-1.88, 1.88].map(z => <mesh key={z} position={[0, floor + .004, z]} receiveShadow>
      <boxGeometry args={[13.5, .008, .034]} />
      <meshStandardMaterial color="#c3ac75" roughness={.83} />
    </mesh>)}
    {[-5, -1.4, 1.8, 5.2].map((x, index) => {
      const riserHeight = [.11, .92, .72, .04][index];
      return <group key={x} position={[x, -2.04, 0]}>
        {[-.55, .55].map(offset => <mesh key={offset} position={[offset, riserHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[.14, riserHeight, 1.55]} />
          <meshStandardMaterial color="#697782" metalness={.5} roughness={.52} />
        </mesh>)}
      </group>;
    })}
    <mesh position={[0, 1.8, -5.8]} receiveShadow>
      <boxGeometry args={[42, 8, .12]} />
      <meshStandardMaterial color="#303941" roughness={.84} />
    </mesh>
    {[-12, -6, 0, 6, 12].map(x => <group key={x} position={[x, 0, -5.67]}>
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[.12, 7.55, .09]} />
        <meshStandardMaterial color="#46515b" roughness={.7} />
      </mesh>
      <mesh position={[1.9, 3.45, 0]}>
        <boxGeometry args={[2.5, .033, .12]} />
        <meshBasicMaterial color="#b8d0db" />
      </mesh>
    </group>)}
  </>;
}
