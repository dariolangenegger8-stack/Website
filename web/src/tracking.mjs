export function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function measure(last, point) {
  if (!last || point.coords.accuracy > 30 || last.coords.accuracy > 30) return null;
  const seconds = (point.timestamp - last.timestamp) / 1000;
  const km = distanceKm(last.coords, point.coords);
  if (seconds <= 0 || seconds >= 30 || km <= 0.003 || km / seconds >= 0.06) return null;
  const speed = point.coords.speed;
  const gain = point.coords.altitude !== null && last.coords.altitude !== null ? point.coords.altitude - last.coords.altitude : 0;
  return { km, maxSpeed: Number.isFinite(speed) && speed >= 0 && speed <= 60 ? speed * 3.6 : null, ascent: gain > 3 && gain < 50 ? gain : 0 };
}
