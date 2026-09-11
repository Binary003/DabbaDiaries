export interface ResolvedLocation {
    latitude: number;
    longitude: number;
    pincode: string;
    locality: string;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ResolvedLocation> {
    // Nominatim is suitable for this prototype only. Before launch, move this
    // behind a paid provider such as Google Maps Geocoding due to rate limits.
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`, {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Unable to resolve this location.');
    const result = await response.json() as { address?: Record<string, string> };
    const address = result.address ?? {};
    const pincode = address.postcode?.match(/\d{6}/)?.[0] ?? '';
    const locality = address.suburb ?? address.neighbourhood ?? address.city_district ?? address.city ?? '';
    if (!pincode) throw new Error('No pincode was found for this location.');
    return { latitude, longitude, pincode, locality };
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location is not supported by this browser.'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
}