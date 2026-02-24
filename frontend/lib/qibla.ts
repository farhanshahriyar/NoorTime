import { model as geomagneticModel } from 'geomagnetism';

export const KAABA_COORDS = {
  lat: 21.4225,
  lng: 39.8262,
};

export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function shortestSignedAngleDelta(fromDeg: number, toDeg: number): number {
  const diff = normalizeAngle(toDeg - fromDeg + 180) - 180;
  return diff === -180 ? 180 : diff;
}

export function getQiblaBearing(lat: number, lng: number): number {
  const lat1 = toRadians(lat);
  const lat2 = toRadians(KAABA_COORDS.lat);
  const dLon = toRadians(KAABA_COORDS.lng - lng);

  const y = Math.sin(dLon);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(dLon);
  const bearing = toDegrees(Math.atan2(y, x));
  return normalizeAngle(bearing);
}

export function getMagneticDeclination(lat: number, lng: number, at: Date = new Date()): number {
  try {
    const wmm = geomagneticModel(at);
    const point = wmm.point([lat, lng]);
    return Number.isFinite(point.decl) ? point.decl : 0;
  } catch {
    return 0;
  }
}

export function magneticHeadingToTrueHeading(magneticHeading: number, declination: number): number {
  return normalizeAngle(magneticHeading + declination);
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}
