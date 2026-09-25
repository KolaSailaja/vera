'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  Radio,
  RefreshCw,
  Calendar,
  Layers,
  Thermometer,
  Wind,
  Gauge,
  Droplets,
} from 'lucide-react';

export default function EvidencePage() {
  const [latestEval, setLatestEval] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedEval, setSelectedEval] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadEvidenceData = async () => {
    setLoading(true);
    try {
      const [lRes, hRes] = await Promise.all([
        fetch('/api/quality/latest'),
        fetch('/api/quality/history?limit=50'),
      ]);

      const lJson = await lRes.json();
      const hJson = await hRes.json();

      if (lJson.success && lJson.data) {
        setLatestEval(lJson.data);
        setSelectedEval(lJson.data);
      }

      if (hJson.success && Array.isArray(hJson.data)) {
        setHistory(hJson.data);
        if (!lJson.data && hJson.data.length > 0) {
          setLatestEval(hJson.data[0]);
          setSelectedEval(hJson.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch evidence data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidenceData();
  }, []);

  const handleSelectEvent = async (item: any) => {
    setSelectedEval(item);
    try {
      const res = await fetch(`/api/quality/${encodeURIComponent(item.timestamp)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedEval(json.data);
      }
    } catch (err) {
      console.error('Error fetching event by timestamp:', err);
    }
  };

  const active = selectedEval || latestEval;
  const evidence = active?.evidence;
  const measured = evidence?.measured;
  const calcs = evidence?.calculations;
  const checks = evidence?.checksTriggered || [];

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return <span className="badge badge-pass">✓ HIGH CONFIDENCE</span>;
      case 'MEDIUM':
        return <span className="badge badge-warn">⚡ MEDIUM CONFIDENCE</span>;
      case 'LOW':
        return <span className="badge badge-fail">⚠ LOW CONFIDENCE</span>;
      case 'INSUFFICIENT':
      default:
        return <span className="badge badge-neutral">✖ INSUFFICIENT DATA</span>;
    }
  };

  return (
    <>
      <Header />

      <main className="content-body">
        <div className="page-header-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">Rainfall Evidence & Data Quality Screening</h1>
              <p className="page-subtitle">
                Deterministic physical rules evaluated on station telemetry to determine observation reliability.
              </p>
            </div>
            <button onClick={loadEvidenceData} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh Evidence
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Running physical quality control checks..." />
        ) : !active ? (
          <div className="empty-state">
            No observation evidence recorded in SQLite database.
          </div>
        ) : (
          <>
            {/* Overview Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    {getConfidenceBadge(active.confidence)}
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      Station: {active.stationId}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={13} />
                    Observation Timestamp: <strong>{new Date(active.timestamp).toUTCString()}</strong>
                    <span>|</span>
                    <Calendar size={13} />
                    Interval: <strong>15-Minute Telemetry</strong>
                  </div>
                </div>
              </div>

              {/* Rationale Explanation Box */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  Scientific Rationale & Explanation
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                  {active.explanation}
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <div className="metric-box">
                  <div className="metric-label">Rain Gauge 1</div>
                  <div className="metric-value">
                    {measured?.rainGauge1 !== null && measured?.rainGauge1 !== undefined ? `${measured.rainGauge1} mm` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Rain Gauge 2</div>
                  <div className="metric-value">
                    {measured?.rainGauge2 !== null && measured?.rainGauge2 !== undefined ? `${measured.rainGauge2} mm` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Absolute Difference (|G1-G2|)</div>
                  <div className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                    {calcs?.gaugeDifferenceMm !== null && calcs?.gaugeDifferenceMm !== undefined ? `${calcs.gaugeDifferenceMm} mm` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Discrepancy Ratio (D)</div>
                  <div className="metric-value">
                    {calcs?.gaugeDisagreementRatio !== null && calcs?.gaugeDisagreementRatio !== undefined ? `${(calcs.gaugeDisagreementRatio * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Checks Table Card */}
            <div className="card">
              <h3 className="card-title">Quality Control Checks Matrix</h3>
              <p className="card-description">
                Deterministic rules evaluated on telemetry stream to verify physical bounds and sensor integrity.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Check Name</th>
                      <th>Reason Code</th>
                      <th>Check Result</th>
                      <th>Evaluation Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((chk: any, idx: number) => (
                      <tr key={idx}>
                        <td><strong>{chk.checkName}</strong></td>
                        <td><code>{chk.reasonCode}</code></td>
                        <td>
                          {chk.passed ? (
                            <span className="badge badge-pass">PASS</span>
                          ) : (
                            <span className="badge badge-warn">FLAGGED</span>
                          )}
                        </td>
                        <td style={{ color: chk.passed ? 'var(--text-main)' : 'var(--status-warn-text)' }}>
                          {chk.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Measured Environmental Parameters Card */}
            <div className="card">
              <h3 className="card-title">Measured Environmental Parameters</h3>
              <p className="card-description">
                Stored environmental parameters for timestamp <code>{active.timestamp}</code>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div className="metric-box">
                  <div className="metric-label">Instantaneous Rain</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.rainfallInstantaneous !== null && measured?.rainfallInstantaneous !== undefined ? `${measured.rainfallInstantaneous} mm` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Daily Cumulative</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.rainfallDaily !== null && measured?.rainfallDaily !== undefined ? `${measured.rainfallDaily} mm` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Temperature</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.temperature !== null && measured?.temperature !== undefined ? `${measured.temperature} °C` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Humidity</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.humidity !== null && measured?.humidity !== undefined ? `${measured.humidity} %` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Pressure</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.pressure !== null && measured?.pressure !== undefined ? `${measured.pressure} hPa` : 'N/A'}
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Wind Speed</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {measured?.windSpeed !== null && measured?.windSpeed !== undefined ? `${measured.windSpeed} m/s` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Timeline Card */}
            <div className="card">
              <h3 className="card-title">Confidence Event Timeline</h3>
              <p className="card-description">
                Historical record of observation evaluations. Click any row to inspect its evidence details above.
              </p>

              {history.length === 0 ? (
                <div className="empty-state">No timeline events recorded.</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Station ID</th>
                        <th>Confidence Rating</th>
                        <th>Triggered Reason Codes</th>
                        <th>Gauge Diff (D)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => {
                        const isSelected = active?.id === item.id || active?.timestamp === item.timestamp;
                        return (
                          <tr
                            key={item.id}
                            style={{
                              background: isSelected ? '#f0fdf4' : 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleSelectEvent(item)}
                          >
                            <td><strong>{new Date(item.timestamp).toUTCString()}</strong></td>
                            <td><code>{item.stationId}</code></td>
                            <td>{getConfidenceBadge(item.confidence)}</td>
                            <td>
                              {item.reasonCodes?.length === 0 ? (
                                <span style={{ color: 'var(--status-pass-text)', fontSize: '0.75rem' }}>Passed All</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                  {item.reasonCodes.map((rc: string) => (
                                    <code key={rc} style={{ fontSize: '0.7rem' }}>
                                      {rc}
                                    </code>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {item.gaugeDifferenceMm !== null && item.gaugeDifferenceMm !== undefined ? `${item.gaugeDifferenceMm} mm` : '-'}
                            </td>
                            <td>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectEvent(item);
                                }}
                                className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                {isSelected ? 'Inspecting' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
