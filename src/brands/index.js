import uaf from './uaf.json';
import lezenSchrijven from './lezen-schrijven.json';
import followThis from './follow-this.json';
import takecarebnb from './takecarebnb.json';
import nsgk from './nsgk.json';
import stjosefs from './stjosefs.json';
import arf from './arf.json';
import hamlin from './hamlin.json';
import vso from './vso.json';
import pazHolandesa from './paz-holandesa.json';

const brands = {
  uaf,
  'lezen-schrijven': lezenSchrijven,
  'follow-this': followThis,
  takecarebnb,
  nsgk,
  stjosefs,
  arf,
  hamlin,
  vso,
  'paz-holandesa': pazHolandesa,
};

export function getBrand(id) {
  return brands[id] || null;
}

export function getAllBrands() {
  return Object.values(brands);
}

export function getBrandIds() {
  return Object.keys(brands);
}

export default brands;
