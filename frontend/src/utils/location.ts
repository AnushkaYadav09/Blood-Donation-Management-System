// Free reverse geocoding using OpenStreetMap Nominatim — no API key needed

export function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Geocode failed');
    const data = await res.json() as {
      address?: { city?: string; town?: string; village?: string; county?: string; state?: string };
    };
    const a = data.address;
    return a?.city || a?.town || a?.village || a?.county || a?.state || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export async function getCityFromGPS(): Promise<{ city: string; lat: number; lng: number }> {
  const coords = await getCurrentPosition();
  const city = await reverseGeocode(coords.latitude, coords.longitude);
  return { city, lat: coords.latitude, lng: coords.longitude };
}
