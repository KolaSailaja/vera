'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import {
  GitCompare,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  MapPin,
  CheckCircle,
  Layers,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function ComparisonPage() {
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [stationConfigured, setStationConfigured] = useState<boolean>(true);
  const [stationCoords, setStationCoords] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadComparisonData();
  }, []);

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        fetch('/api/comparison/daily'),
        fetch('/api/comparison/summary'),
      ]);

      const dJson = await dRes.json();
      const sJson = await sRes.json();

      if (!dJson.stationConfigured) {
        setStationConfigured(false);
      } else {
        setStationConfigured(true);
        setStationCoords(dJson.stationCoordinates);
        setDailyData(dJson.data || []);
      }

      if (sJson.success && sJson.summary) {
        setSummary(sJson.summary);
      }
    } catch (err) {
      console.error('Failed to load comparison data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return <span className="badge badge-pass">✓ HIGH</span>;
      case 'MEDIUM':
        return <span className="badge badge-warn">⚡ MEDIUM</span>;
      case 'LOW':
        return <span className="badge badge-fail">⚠ LOW</span>;
      case 'INSUFFICIENT':
      default:
        return <span className="badge badge-neutral">✖ INSUFFICIENT</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CLOSE_AGREEMENT':
        return (
          <span className="badge badge-pass">
            <CheckCircle size={10} /> Close Agreement
          </span>
        );
      case 'GROUND_HIGHER':
        return <span className="badge badge-warn">Ground Higher</span>;
      case 'GROUND_LOWER':
        return <span className="badge badge-warn">Ground Lower</span>;
      case 'DEFERRED':
      default:
        return <span className="badge badge-neutral">Deferred</span>;
    }
  };

  const chartData = [...dailyData]
    .reverse()
    .map((item) => ({
      date: item.date,
      'Ground Rainfall (mm)': item.qualityScreenedPassed ? item.groundRainfallMm : null,
      'CHIRPS Satellite (mm)': item.chirpsRainfallMm,
    }));

  return (
    <>
      <Header />

      <main className="content-body">
        <div className="page-header-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">Ground Station vs Satellite Rainfall Comparison</h1>
              <p className="page-subtitle">
                Quality-screened Conduit daily rainfall cross-validated against CHIRPS v2.0 satellite precipitation estimates.
              </p>
            </div>
            <button onClick={loadComparisonData} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>
        </div>

        {!stationConfigured && !loading && (
          <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '1.25rem', color: '#991b1b', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Station Coordinates Unconfigured:</strong> Configure station latitude and longitude before satellite comparison can run.
              </div>
            </div>
          </div>
        )}

        {/* Station Location Info */}
        <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-main)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={14} color="var(--accent-teal)" />
              Station Coordinates: <strong>{stationCoords ? `${stationCoords.lat}° N, ${stationCoords.lon}° E` : 'Unconfigured'}</strong>
            </span>
            <span>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Layers size={14} color="var(--accent-blue)" />
              Dataset: <strong>CHIRPS v2.0 Daily Precipitation (~0.05° spatial resolution)</strong>
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Fetching CHIRPS satellite grid and calculating ground vs satellite discrepancies..." />
        ) : dailyData.length === 0 ? (
          <div className="empty-state">
            No comparison data available in SQLite database.
          </div>
        ) : (
          <>
            {/* Statistical Summary Grid */}
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="metric-box">
                  <div className="metric-label">Valid Quality-Screened Days</div>
                  <div className="metric-value">
                    {summary.qualityScreenedValidDays} / {summary.totalDays}
                  </div>
                  <div className="metric-subtext">{summary.deferredDays} Days Deferred</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Mean Bias (Ground - CHIRPS)</div>
                  <div className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                    {summary.sufficientSamples && summary.metrics.biasMm !== null
                      ? `${summary.metrics.biasMm > 0 ? '+' : ''}${summary.metrics.biasMm} mm`
                      : 'N/A'}
                  </div>
                  <div className="metric-subtext">{summary.sufficientSamples ? 'Systematic Offset' : 'N < 3 Samples'}</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Mean Absolute Error (MAE)</div>
                  <div className="metric-value">
                    {summary.sufficientSamples && summary.metrics.maeMm !== null
                      ? `${summary.metrics.maeMm} mm`
                      : 'N/A'}
                  </div>
                  <div className="metric-subtext">Average Magnitude Error</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Root Mean Square Error (RMSE)</div>
                  <div className="metric-value">
                    {summary.sufficientSamples && summary.metrics.rmseMm !== null
                      ? `${summary.metrics.rmseMm} mm`
                      : 'N/A'}
                  </div>
                  <div className="metric-subtext">Penalizes Outliers</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Pearson Correlation (r)</div>
                  <div className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                    {summary.sufficientSamples && summary.metrics.correlation !== null
                      ? summary.metrics.correlation.toFixed(3)
                      : 'N/A'}
                  </div>
                  <div className="metric-subtext">Linear Co-variability</div>
                </div>
              </div>
            )}

            {/* Time-Series Chart Card */}
            <div className="card">
              <h3 className="card-title">Daily Rainfall Time-Series: Ground vs CHIRPS Satellite</h3>
              <p className="card-description">
                Analytical plot of quality-screened ground daily totals against CHIRPS satellite estimates.
              </p>

              {mounted && chartData.length > 0 ? (
                <div style={{ width: '100%', height: 300, marginTop: '0.75rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Precipitation (mm)', angle: -90, position: 'insideLeft', fill: '#64748b', style: { fontSize: 11 } }} />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          color: '#0f172a',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                      <Bar dataKey="Ground Rainfall (mm)" fill="#0f766e" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      <Line type="monotone" dataKey="CHIRPS Satellite (mm)" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">No chart data available.</div>
              )}
            </div>

            {/* Daily Matrix Table Card */}
            <div className="card">
              <h3 className="card-title">Daily Ground vs Satellite Evaluation Matrix</h3>
              <p className="card-description">
                Quality-screened Conduit ground observations evaluated against CHIRPS satellite daily estimates.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Quality-Screened Ground Rain</th>
                      <th>CHIRPS Satellite Rain</th>
                      <th>Difference (|G-S|)</th>
                      <th>Local Confidence</th>
                      <th>Status</th>
                      <th>Comparison Interpretation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.date}</strong></td>
                        <td style={{ fontWeight: 600 }}>
                          {item.qualityScreenedPassed && item.groundRainfallMm !== null
                            ? `${item.groundRainfallMm} mm`
                            : <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Deferred</span>}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.chirpsRainfallMm} mm</td>
                        <td style={{ fontWeight: 600, color: item.absoluteDifferenceMm !== null ? 'var(--accent-teal)' : 'inherit' }}>
                          {item.absoluteDifferenceMm !== null ? `${item.absoluteDifferenceMm} mm` : '-'}
                        </td>
                        <td>{getConfidenceBadge(item.localConfidence)}</td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td style={{ fontSize: '0.8rem', color: item.qualityScreenedPassed ? 'var(--text-main)' : 'var(--text-light)', maxWidth: '360px' }}>
                          {item.interpretation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Methodology Section */}
            <div className="card" style={{ background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <HelpCircle size={16} color="var(--accent-teal)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                    Scientific Comparison Methodology
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.15rem' }}>
                    Ground-satellite evaluation operates under strict scientific comparison rules without declaring either source wrong without evidence.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>1. Point Gauge vs Satellite Pixel</strong>
                  Rain gauges measure localized physical catch over ~200 cm². CHIRPS satellite estimates cloud-top moisture over ~0.05° grid cells (~5.5 km x 5.5 km). Discrepancies naturally arise from spatial averaging.
                </div>

                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>2. Quality Screening Gating</strong>
                  Only observations passing local quality screening (HIGH or MEDIUM confidence) serve as ground reference. LOW or INSUFFICIENT confidence observations are deferred.
                </div>

                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>3. Neutral Discrepancy Rationale</strong>
                  High-intensity localized convective rain showers may hit a ground gauge directly while averaging out over a wider satellite pixel.
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
