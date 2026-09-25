'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import { RefreshCw, Radio, Tag, AlertTriangle } from 'lucide-react';

export default function ObservationsPage() {
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/observations');
      const json = await res.json();
      if (json.success) {
        setObservations(json.data || []);
      } else {
        setErrorMsg(json.error || 'Failed to fetch observations from database');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error fetching observations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasGauge1 = observations.some((o) => o.rainGauge1 !== null && o.rainGauge1 !== undefined);
  const hasGauge2 = observations.some((o) => o.rainGauge2 !== null && o.rainGauge2 !== undefined);
  const hasRainInstant = observations.some((o) => o.rainfallInstantaneous !== null && o.rainfallInstantaneous !== undefined);
  const hasRainDaily = observations.some((o) => o.rainfallDaily !== null && o.rainfallDaily !== undefined);
  const hasTemp = observations.some((o) => o.temperature !== null && o.temperature !== undefined);
  const hasHumidity = observations.some((o) => o.humidity !== null && o.humidity !== undefined);
  const hasPressure = observations.some((o) => o.pressure !== null && o.pressure !== undefined);
  const hasWind = observations.some(
    (o) =>
      (o.windSpeed !== null && o.windSpeed !== undefined) ||
      (o.windGust !== null && o.windGust !== undefined) ||
      (o.windDirection !== null && o.windDirection !== undefined)
  );

  return (
    <>
      <Header />

      <main className="content-body">
        <div className="page-header-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">Station Observation Registry</h1>
              <p className="page-subtitle">
                Raw ground station telemetry stored in SQLite database from Conduit telemetry feed.
              </p>
            </div>
            <button onClick={loadData} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh Records
            </button>
          </div>
        </div>

        <div className="card">
          {loading ? (
            <LoadingState message="Loading station telemetry observations..." />
          ) : errorMsg ? (
            <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', color: '#991b1b', fontSize: '0.85rem' }}>
              <AlertTriangle size={16} style={{ marginBottom: '0.35rem' }} />
              <div>Error: {errorMsg}</div>
            </div>
          ) : observations.length === 0 ? (
            <div className="empty-state">
              No observations recorded in SQLite database.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Station ID</th>
                    <th>Source Type</th>

                    {hasGauge1 && <th>Gauge 1</th>}
                    {hasGauge2 && <th>Gauge 2</th>}
                    {hasRainInstant && <th>Instant Rain</th>}
                    {hasRainDaily && <th>Daily Rain</th>}
                    {hasTemp && <th>Temperature</th>}
                    {hasHumidity && <th>Humidity</th>}
                    {hasPressure && <th>Pressure</th>}
                    {hasWind && <th>Wind</th>}
                  </tr>
                </thead>
                <tbody>
                  {observations.map((obs) => (
                    <tr key={obs.id}>
                      <td><strong>{new Date(obs.timestamp).toUTCString()}</strong></td>
                      <td><code>{obs.stationId}</code></td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          <Tag size={10} /> {obs.sourceType}
                        </span>
                      </td>

                      {hasGauge1 && <td>{obs.rainGauge1 !== null ? `${obs.rainGauge1} mm` : '-'}</td>}
                      {hasGauge2 && <td>{obs.rainGauge2 !== null ? `${obs.rainGauge2} mm` : '-'}</td>}
                      {hasRainInstant && (
                        <td style={{ fontWeight: 600, color: obs.rainfallInstantaneous < 0 ? '#991b1b' : 'inherit' }}>
                          {obs.rainfallInstantaneous !== null ? `${obs.rainfallInstantaneous} mm` : '-'}
                        </td>
                      )}
                      {hasRainDaily && <td>{obs.rainfallDaily !== null ? `${obs.rainfallDaily} mm` : '-'}</td>}
                      {hasTemp && <td>{obs.temperature !== null ? `${obs.temperature} °C` : '-'}</td>}
                      {hasHumidity && <td>{obs.humidity !== null ? `${obs.humidity} %` : '-'}</td>}
                      {hasPressure && <td>{obs.pressure !== null ? `${obs.pressure} hPa` : '-'}</td>}
                      {hasWind && (
                        <td>
                          {obs.windSpeed !== null ? `${obs.windSpeed} m/s` : ''}
                          {obs.windDirection !== null ? ` @ ${obs.windDirection}°` : ''}
                          {!obs.windSpeed && !obs.windDirection ? '-' : ''}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
