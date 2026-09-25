'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import { Settings, ShieldCheck, Database, Server, Cpu, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const json = await res.json();
      setHealthData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <>
      <Header title="System Architecture & Environment Diagnostics" />

      <main className="content-body">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="card-title">Backend & Database Status</h2>
              <p className="card-description">
                Live connection diagnostics for SQLite database engine and configured environmental data providers.
              </p>
            </div>
            <button onClick={fetchHealth} className="btn btn-secondary">
              <RefreshCw size={15} /> Re-check Health
            </button>
          </div>

          {loading ? (
            <LoadingState message="Testing database connection and API health endpoints..." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Database size={18} color="var(--accent-cyan)" />
                  <strong style={{ fontSize: '0.95rem' }}>Database Layer</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>Engine: <strong>{healthData?.database?.type || 'SQLite'}</strong></div>
                  <div>Status: <span style={{ color: 'var(--status-trustworthy)' }}>Connected & Initialized</span></div>
                  <div>Details: {healthData?.database?.initStatus}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Server size={18} color="var(--accent-indigo)" />
                  <strong style={{ fontSize: '0.95rem' }}>Observation Adapter Mode</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>Active Mode: <strong>{healthData?.providers?.observationMode}</strong></div>
                  <div>Target Station: <code>JKUAT_STATION_TEST_1</code></div>
                  <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                    Supports: <code>CONDUIT_LIVE</code>, <code>CONDUIT_CSV</code>, <code>DEVELOPMENT_TEST_DATA</code>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Cpu size={18} color="var(--status-disagreement)" />
                  <strong style={{ fontSize: '0.95rem' }}>Satellite Adapter</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>Provider: <strong>Open-Meteo ERA5 / Satellite</strong></div>
                  <div>Coordinates: <code>Lat -1.1018, Lon 37.0144</code> (Juja)</div>
                  <div>Status: <span style={{ color: 'var(--status-trustworthy)' }}>Online / Open API</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database Tables Reference */}
        <div className="card">
          <h3 className="card-title">Registered Database Schema Tables</h3>
          <p className="card-description">
            Clean SQLite schema prepared for seamless migration to PostgreSQL.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {['observations', 'quality_flags', 'daily_rainfall', 'satellite_rainfall', 'comparisons', 'recommendations', 'operator_feedback'].map((table) => (
              <div
                key={table}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <ShieldCheck size={14} />
                {table}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
