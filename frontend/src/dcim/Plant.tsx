import { Line } from "@react-three/drei";
export const plants = [
  "Utility intake",
  "Standby generators",
  "Chilled-water plant",
] as const;
export function Plant({ select }: { select: (id: string) => void }) {
  return (
    <>
      {plants.map((id, i) => (
        <group
          key={id}
          position={[-40, 0, -25 + i * 15]}
          onClick={(e) => {
            e.stopPropagation();
            select(id);
          }}
        >
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[5, 0.24, 9]} />
            <meshStandardMaterial color="#65737e" />
          </mesh>
          {[-2.6, 0, 2.6].map((z) => (
            <group key={z} position={[0, 0, z]}>
              <mesh position={[0, 1, 0]}>
                <boxGeometry args={[3.2, 1.7, 2.1]} />
                <meshStandardMaterial
                  color={["#788da7", "#9a8861", "#809f9d"][i]}
                />
              </mesh>
              {[-0.76, 0.76].map((x) => (
                <mesh key={x} position={[x, 1.95, 0]}>
                  <cylinderGeometry
                    args={[i === 0 ? 0.14 : 0.53, 0.4, 0.22, 12]}
                  />
                  <meshStandardMaterial color="#354550" />
                </mesh>
              ))}
            </group>
          ))}
          <Line
            points={[
              [1.8, 0.6, 0],
              [3.3, 0.6, 0],
              [3.3, 0.6, 4],
              [6, 0.6, 4],
            ]}
            color={i === 2 ? "#4acac4" : "#b99a68"}
            lineWidth={3}
          />
        </group>
      ))}
    </>
  );
}
