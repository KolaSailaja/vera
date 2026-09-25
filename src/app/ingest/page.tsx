'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import {
  DownloadCloud,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Upload,
  FileText,
  AlertCircle,
  Database,
  Radio,
} from 'lucide-react';

export default function IngestionPage() {
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Import Form State
  const [importSource, setImportSource] = useState<'LIVE_CONDUIT' | 'IMPORTED_CONDUIT_DATA'>('IMPORTED_CONDUIT_DATA');
  const [importFormat, setImportFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [rawInputText, setRawInputText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/ingest/status');
      const json = await res.json();
      if (json.success) {
        setStatusData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunIngestion = async (overrideText?: string, overrideFormat?: 'CSV' | 'JSON') => {
    setIngesting(true);
    setLastResult(null);

    const payload = {
      sourceType: importSource,
      format: overrideFormat || importFormat,
      rawText: overrideText !== undefined ? overrideText : rawInputText,
    };

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      setLastResult(json);
      await fetchStatus();
    } catch (err: any) {
      setLastResult({
        success: false,
        error: err?.message || 'Ingestion request failed',
      });
    } finally {
      setIngesting(false);
    }
  };

  const loadSampleCSV = () => {
    setImportSource('IMPORTED_CONDUIT_DATA');
    setImportFormat('CSV');
    setRawInputText(
`timestamp,station_id,rain_gauge_1,rain_gauge_2,rainfall_instantaneous,rainfall_daily,temperature,humidity,pressure,wind_speed,wind_gust,wind_direction
2026-09-24T08:00:00Z,JKUAT_MAIN_STATION,5.2,5.1,5.2,12.4,22.4,78.5,1013.25,3.4,5.1,180
2026-09-24T09:00:00Z,JKUAT_MAIN_STATION,8.0,8.1,8.0,20.4,23.1,80.0,1012.80,4.2,6.5,195
2026-09-24T10:00:00Z,JKUAT_MAIN_STATION,-2.5,0.0,-2.5,20.4,21.0,82.0,1011.50,2.1,3.0,170`
    );
  };

  const loadSampleJSON = () => {
    setImportSource('IMPORTED_CONDUIT_DATA');
    setImportFormat('JSON');
    setRawInputText(
JSON.stringify(
  [
    {
      timestamp: '2026-09-24T11:00:00Z',
      station_id: 'JKUAT_FARM_STATION',
      rain_gauge_1: 0.0,
      rainfall_instantaneous: 0.0,
      rainfall_daily: 0.0,
      temperature: 24.5,
      humidity: 65.0,
      pressure: 1014.1,
    },
    {
      timestamp: '2026-09-24T12:00:00Z',
      station_id: 'JKUAT_FARM_STATION',
      rain_gauge_1: 14.5,
      rainfall_instantaneous: 14.5,
      rainfall_daily: 14.5,
      temperature: 22.0,
      humidity: 88.0,
      pressure: 1010.5,
      wind_speed: 6.8,
      wind_gust: 12.1,
    },
    {
      // Malformed record to demonstrate validation error handling
      timestamp: '',
      station_id: 'JKUAT_FARM_STATION',
      rainfall_instantaneous: -99.9,
    },
  ],
  null,
  2
)
    );
  };

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'LIVE_CONDUIT':
        return (
          <span className="badge badge-trustworthy">
            ● LIVE CONDUIT
          </span>
        );
      case 'IMPORTED_CONDUIT_DATA':
        return (
          <span className="badge badge-disagreement">
            ● IMPORTED CONDUIT DATA
          </span>
        );
      case 'NO_DATA':
      default:
        return (
          <span className="badge badge-insufficient">
            ● NO DATA
          </span>
        );
    }
  };

  return (
    <>
      <Header title="Environmental Data Ingestion Pipeline" />

      <main className="content-body">
        {/* Source Status Overview Header Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Primary Source Status</h2>
                {loadingStatus ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                ) : (
                  renderSourceBadge(statusData?.activeSource)
                )}
              </div>
              <p className="card-description" style={{ marginBottom: '0.75rem' }}>
                JKUAT Conduit Adapter & Multi-Format Environmental Data Loader.
              </p>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Live Conduit API Status: </span>
                  {statusData?.conduitApi?.available ? (
                    <strong style={{ color: 'var(--status-trustworthy)' }}>Operational</strong>
                  ) : (
                    <strong style={{ color: 'var(--status-faulty)' }}>Source Unavailable</strong>
                  )}
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Last Ingestion: </span>
                  <strong>{statusData?.lastIngestionTimestamp ? new Date(statusData.lastIngestionTimestamp).toLocaleString() : 'Never'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Observations Stored: </span>
                  <strong>{statusData?.totalStoredObservations ?? 0} records</strong>
                </div>
              </div>
            </div>

            <button onClick={fetchStatus} disabled={loadingStatus} className="btn btn-secondary">
              <RefreshCw size={15} /> Refresh Status
            </button>
          </div>

          {!statusData?.conduitApi?.available && (
            <div
              style={{
                marginTop: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: 'var(--status-faulty)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>
                {statusData?.conduitApi?.statusMessage || 'Source unavailable: Live Conduit API endpoint is not connected.'}{' '}
                You can import station records directly using CSV or JSON.
              </span>
            </div>
          )}
        </div>

        {/* Data Ingestion Control Card */}
        <div className="card">
          <h3 className="card-title">Run Ingestion Adapter</h3>
          <p className="card-description">
            Select data ingestion source and upload or paste raw Conduit weather station telemetry.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setImportSource('LIVE_CONDUIT')}
              className={`btn ${importSource === 'LIVE_CONDUIT' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Radio size={15} /> Fetch Live Conduit API
            </button>

            <button
              onClick={() => setImportSource('IMPORTED_CONDUIT_DATA')}
              className={`btn ${importSource === 'IMPORTED_CONDUIT_DATA' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Upload size={15} /> Import CSV / JSON File
            </button>
          </div>

          {importSource === 'LIVE_CONDUIT' ? (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Live Conduit API Connectivity
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Endpoint URL: <code>{statusData?.conduitApi?.endpointUrl || 'Not configured'}</code>
              </p>

              <button
                onClick={() => handleRunIngestion()}
                disabled={ingesting || !statusData?.conduitApi?.available}
                className="btn btn-primary"
              >
                {ingesting ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Connecting to Conduit API...
                  </>
                ) : (
                  <>
                    <DownloadCloud size={15} />
                    Pull Live Telemetry
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setImportFormat('CSV')}
                    className={`btn ${importFormat === 'CSV' ? 'btn-secondary' : 'btn-secondary'}`}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderColor: importFormat === 'CSV' ? 'var(--accent-cyan)' : 'var(--border-color)',
                      color: importFormat === 'CSV' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    }}
                  >
                    CSV Format
                  </button>

                  <button
                    onClick={() => setImportFormat('JSON')}
                    className={`btn ${importFormat === 'JSON' ? 'btn-secondary' : 'btn-secondary'}`}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderColor: importFormat === 'JSON' ? 'var(--accent-cyan)' : 'var(--border-color)',
                      color: importFormat === 'JSON' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    }}
                  >
                    JSON Format
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={loadSampleCSV} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                    <FileText size={13} /> Load Sample CSV
                  </button>
                  <button onClick={loadSampleJSON} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                    <FileText size={13} /> Load Sample JSON
                  </button>
                </div>
              </div>

              <textarea
                rows={8}
                value={rawInputText}
                onChange={(e) => setRawInputText(e.target.value)}
                placeholder={
                  importFormat === 'CSV'
                    ? 'Paste Conduit CSV payload here (e.g., timestamp,station_id,rainfall_instantaneous,temperature,...)'
                    : 'Paste Conduit JSON payload array here...'
                }
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '0.85rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                }}
              />

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => handleRunIngestion()}
                  disabled={ingesting || !rawInputText.trim()}
                  className="btn btn-primary"
                >
                  {ingesting ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      Parsing & Normalizing...
                    </>
                  ) : (
                    <>
                      <DownloadCloud size={15} />
                      Import & Validate Observations
                    </>
                  )}
                </button>

                <button
                  onClick={() => setRawInputText('')}
                  disabled={ingesting || !rawInputText}
                  className="btn btn-secondary"
                >
                  Clear Input
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ingestion Results & Validation Error Log */}
        {lastResult && (
          <div className="card" style={{ borderColor: lastResult.success ? 'var(--border-glow)' : 'rgba(239, 68, 68, 0.4)' }}>
            <h3 className="card-title">Ingestion Pipeline Report</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</div>
                <div style={{ fontWeight: 700, color: lastResult.success ? 'var(--status-trustworthy)' : 'var(--status-faulty)' }}>
                  {lastResult.success ? 'SUCCESS' : 'FAILED'}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Source</div>
                <div>{renderSourceBadge(lastResult.sourceType)}</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Imported Records</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--status-trustworthy)' }}>
                  {lastResult.importedCount ?? 0}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duplicates Skipped</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {lastResult.skippedDuplicatesCount ?? 0}
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Validation Errors</div>
                <div
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: lastResult.validationErrors?.length > 0 ? 'var(--status-faulty)' : 'var(--status-trustworthy)',
                  }}
                >
                  {lastResult.validationErrors?.length ?? 0}
                </div>
              </div>
            </div>

            {/* Validation Errors List */}
            {lastResult.validationErrors && lastResult.validationErrors.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--status-faulty)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} /> Validation Error Log
                </h4>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row #</th>
                        <th>Target Field</th>
                        <th>Validation Error Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastResult.validationErrors.map((err: any, idx: number) => (
                        <tr key={idx}>
                          <td><strong>Row {err.row}</strong></td>
                          <td><code>{err.field}</code></td>
                          <td style={{ color: 'var(--status-faulty)' }}>{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
