'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import { Flag, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function QualityFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quality-flags');
      const json = await res.json();
      if (json.success) {
        setFlags(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="badge badge-faulty">
            <AlertTriangle size={12} /> CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="badge badge-disagreement">
            <AlertTriangle size={12} /> WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="badge badge-trustworthy">
            <CheckCircle size={12} /> PASSED
          </span>
        );
    }
  };

  return (
    <>
      <Header title="Observation Quality Screening Flags" />

      <main className="content-body">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="card-title">Physical Quality Flags</h2>
              <p className="card-description">
                Evaluation results checking range limits, stuck values, missing parameters, and battery voltage.
              </p>
            </div>
            <button onClick={loadFlags} className="btn btn-secondary">
              <RefreshCw size={15} /> Refresh Flags
            </button>
          </div>

          {loading ? (
            <LoadingState message="Loading physical quality evaluation flags..." />
          ) : flags.length === 0 ? (
            <div className="empty-state">
              No quality flags recorded. Run data ingestion to execute physical quality screening.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Flag ID</th>
                    <th>Observation Target</th>
                    <th>Flag Code</th>
                    <th>Severity</th>
                    <th>Evaluation Reason</th>
                    <th>Evaluated At</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((flag) => (
                    <tr key={flag.id}>
                      <td><code>{flag.id}</code></td>
                      <td><code>{flag.observationId}</code></td>
                      <td style={{ fontWeight: 600 }}>{flag.flagCode}</td>
                      <td>{getSeverityBadge(flag.severity)}</td>
                      <td style={{ color: 'var(--text-primary)', maxWidth: '400px' }}>{flag.reason}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{flag.evaluatedAt}</td>
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
