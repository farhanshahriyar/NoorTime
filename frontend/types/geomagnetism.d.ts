declare module 'geomagnetism' {
  export interface GeomagneticPoint {
    decl: number;
    incl: number;
    x: number;
    y: number;
    z: number;
    h: number;
    f: number;
  }

  export interface GeomagneticModel {
    point(coords: [number, number, number?]): GeomagneticPoint;
  }

  export function model(date?: Date): GeomagneticModel;
}
