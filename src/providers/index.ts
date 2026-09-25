import { ObservationProvider } from './observation/interface';
import { ConduitLiveProvider } from './observation/conduit-live';
import { ConduitCSVProvider } from './observation/conduit-csv';
import { ConduitJSONProvider } from './observation/conduit-json';

import { SatelliteProvider } from './satellite/interface';
import { OpenMeteoSatelliteProvider } from './satellite/open-meteo-satellite';
import { DevelopmentTestSatelliteProvider } from './satellite/satellite-test';
import { DataSourceType } from './types';

export function getObservationProvider(
  mode?: DataSourceType,
  rawInput?: string | any[]
): ObservationProvider {
  switch (mode) {
    case 'LIVE_CONDUIT':
      return new ConduitLiveProvider();
    case 'IMPORTED_CONDUIT_DATA':
      if (typeof rawInput === 'string' && rawInput.trim().startsWith('{') || typeof rawInput === 'string' && rawInput.trim().startsWith('[')) {
        return new ConduitJSONProvider(rawInput);
      }
      if (Array.isArray(rawInput)) {
        return new ConduitJSONProvider(rawInput);
      }
      return new ConduitCSVProvider(rawInput);
    case 'NO_DATA':
    default:
      return new ConduitLiveProvider();
  }
}

export function getSatelliteProvider(useTestData = false): SatelliteProvider {
  if (useTestData || process.env.SATELLITE_PROVIDER_MODE === 'DEVELOPMENT_TEST_DATA') {
    return new DevelopmentTestSatelliteProvider();
  }
  return new OpenMeteoSatelliteProvider();
}
