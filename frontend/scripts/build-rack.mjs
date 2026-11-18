// Original schematic rack. Dimensions are scene units and are not vendor specifications.
import { mkdir, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend();
  }
};
const scene = new T.Scene();
const palette = {
  graphite: '#243341', rail: '#8799a6', dark: '#111b25', pcb: '#146353',
  supply: '#378cc7', return: '#ce654e', indicator: '#75dbbc'
};
function assembly(name, draw) {
  const group = new T.Group();
  group.name = name;
  const batches = new Map();
  draw((material, x, y, z, w, h, d) => {
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(new T.BoxGeometry(w,h,d).translate(x,y,z));
  });
  for (const [material, parts] of batches) {
    group.add(new T.Mesh(mergeGeometries(parts), new T.MeshStandardMaterial({
      color: palette[material], metalness: 0.48, roughness: 0.44
    })));
  }
  scene.add(group);
}
assembly('Cabinet', box => {
  for (const x of [-1,1]) {
    box('graphite',x,0,0,.08,3.9,1.42);
    box('rail',x*.94,0,.67,.07,3.8,.05);
    for(let i=0;i<35;i++) box('dark',x*.94,-1.79+i*.105,.703,.034,.045,.016);
  }
  for(const y of [-1.91,1.91]) box('graphite',0,y,0,2.08,.1,1.48);
  box('dark',0,0,-.7,2,3.8,.07);
  for(let i=0;i<5;i++) box('rail',0,1.25-i*.62,-.04,1.88,.025,1.24);
  box('supply',-.86,0,-.55,.075,3.5,.1);
  box('return',.86,0,-.55,.075,3.5,.1);
});
// Door origin is the left hinge. Tray origin is the center of its mounting bay.
assembly('Door', box => {
  for(const x of [0,1.96]) box('graphite',x,0,0,.065,3.76,.07);
  for(const y of [-1.85,1.85]) box('graphite',.98,y,0,1.96,.07,.07);
  for(let i=0;i<21;i++) box('dark',.08+i*.09,0,0,.022,3.66,.025);
  for(let i=0;i<16;i++) box('graphite',.98,-1.73+i*.23,0,1.9,.018,.025);
  box('rail',1.85,0,.075,.055,.38,.08);
});
assembly('Tray', box => {
  box('graphite',0,0,0,1.82,.055,1.19);
  box('pcb',0,.045,-.03,1.67,.025,.94);
  box('dark',0,.11,.59,1.82,.24,.055);
  for(const x of [-.79,.79]) box('rail',x,.13,.645,.12,.12,.07);
  for(let i=0;i<22;i++) box('rail',-.58+i*.052,.11,.624,.018,.095,.009);
  box('indicator',.66,.15,.63,.042,.024,.01);
});
const output = new URL('../public/models/', import.meta.url);
await mkdir(output, {recursive:true});
const binary = await new GLTFExporter().parseAsync(scene,{binary:true});
await writeFile(new URL('liquid-cooled-rack.glb',output),new Uint8Array(binary));
