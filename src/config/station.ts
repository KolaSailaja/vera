export interface StationConfig {
  stationId: string;
  stationName: string;
  latitude: number | null;
  longitude: number | null;
  isConfigured: boolean;
}

export function getStationConfig(): StationConfig {
  const latEnv = process.env.STATION_LAT || process.env.NEXT_PUBLIC_STATION_LAT;
  const lonEnv = process.env.STATION_LON || process.env.NEXT_PUBLIC_STATION_LON;

  const latitude = latEnv ? parseFloat(latEnv) : -1.1018; // Default: JKUAT Station (-1.1018° S)
  const longitude = lonEnv ? parseFloat(lonEnv) : 37.0144; // Default: JKUAT Station (37.0144° E)

  const isConfigured =
    latitude !== null &&
    longitude !== null &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return {
    stationId: process.env.STATION_ID || 'JKUAT_MAIN_STATION',
    stationName: process.env.STATION_NAME || 'JKUAT Conduit Weather Station',
    latitude: isConfigured ? latitude : null,
    longitude: isConfigured ? longitude : null,
    isConfigured,
  };
}
