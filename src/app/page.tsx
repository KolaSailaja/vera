'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import {
  Clock,
  Radio,
  GitCompare,
  RefreshCw,
  Droplets,
  Layers,
  ArrowRight,
  Send,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const [health, setHealth] = useState<any>(null);
  const [latestEval, setLatestEval] = useState<any>(null);
  const [latestComparison, setLatestComparison] = useState<any>(null);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action form state
  const [selectedAction, setSelectedAction] = useState<string>('ACCEPT_OBSERVATION');
  const [actionReason, setActionReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [hRes, qRes, cRes, aRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/quality/latest'),
        fetch('/api/comparison/daily'),
        fetch('/api/actions'),
      ]);

      const hData = await hRes.json();
      const qData = await qRes.json();
      const cData = await cRes.json();
      const aData = await aRes.json();

      setHealth(hData);
      if (qData.success && qData.data) {
        setLatestEval(qData.data);
      }
      if (cData.success && Array.isArray(cData.data) && cData.data.length > 0) {
        setLatestComparison(cData.data[0]);
      }
      if (aData.success && Array.isArray(aData.data)) {
        setRecentActions(aData.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    const interval = setInterval(fetchOverviewData, 30000); // 30-second telemetry polling interval
    return () => clearInterval(interval);
  }, []);

  const handleQuickAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestEval?.observationId || !actionReason.trim()) return;

    setSubmittingAction(true);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observationId: latestEval.observationId,
          action: selectedAction,
          reasonContext: actionReason.trim(),
          operatorName: 'Duty Operator',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionSuccess(`Recorded action "${selectedAction}" for observation ${latestEval.observationId}`);
        setActionReason('');
        const aRes = await fetch('/api/actions');
        const aData = await aRes.json();
        if (aData.success && Array.isArray(aData.data)) {
          setRecentActions(aData.data.slice(0, 5));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAction(false);
    }
  };

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

  const measured = latestEval?.evidence?.measured;
  const calcs = latestEval?.evidence?.calculations;
  const checks = latestEval?.evidence?.checksTriggered || [];

  return (
    <>
      <Header
        sourceMode={health?.conduitSource?.mode}
        isLiveAvailable={health?.conduitSource?.available}
        lastUpdated={latestEval?.timestamp ? new Date(latestEval.timestamp).toUTCString() : undefined}
      />

      <main className="content-body">
        {/* Page Header Block */}
        <div className="page-header-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">Environmental data overview</h1>
              <p className="page-subtitle">
                VERA performs physical screening of Conduit station telemetry across 8 quality rules and cross-validates ground rainfall against CHIRPS satellite estimates.
              </p>
            </div>
            <button onClick={fetchOverviewData} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Retrieving station telemetry, confidence evaluations, and satellite grid..." />
        ) : (
          <>
            {/* Top Metric Overview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Station Status */}
              <div className="metric-box">
                <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={13} color="var(--accent-teal)" /> Station Location & Status
                </div>
                <div className="metric-value" style={{ fontSize: '1.1rem', marginTop: '0.35rem' }}>
                  JKUAT Main Station
                </div>
                <div className="metric-subtext">
                  Lat: -1.1018° | Lon: 37.0144° | Mode: {health?.conduitSource?.mode || 'Active Telemetry'}
                </div>
              </div>

              {/* Latest Rainfall Observation */}
              <div className="metric-box">
                <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Droplets size={13} color="var(--accent-teal)" /> Latest Measured Rainfall
                </div>
                <div className="metric-value" style={{ color: 'var(--accent-teal)' }}>
                  {measured?.rainfallInstantaneous !== null && measured?.rainfallInstantaneous !== undefined
                    ? `${measured.rainfallInstantaneous} mm`
                    : measured?.rainGauge1 !== null && measured?.rainGauge1 !== undefined
                    ? `${measured.rainGauge1} mm`
                    : '0.0 mm'}
                </div>
                <div className="metric-subtext">
                  Daily Cumulative Total: {measured?.rainfallDaily !== null && measured?.rainfallDaily !== undefined ? `${measured.rainfallDaily} mm` : 'N/A'}
                </div>
              </div>

              {/* Gauge 1 vs Gauge 2 Comparison */}
              <div className="metric-box">
                <div className="metric-label">Dual-Gauge Comparison</div>
                <div className="metric-value" style={{ fontSize: '1.1rem', marginTop: '0.35rem' }}>
                  G1: {measured?.rainGauge1 ?? '-'} mm | G2: {measured?.rainGauge2 ?? '-'} mm
                </div>
                <div className="metric-subtext">
                  Absolute Diff: {calcs?.gaugeDifferenceMm !== null && calcs?.gaugeDifferenceMm !== undefined ? `${calcs.gaugeDifferenceMm} mm` : 'N/A'}
                  {calcs?.gaugeDisagreementRatio !== null && calcs?.gaugeDisagreementRatio !== undefined ? ` (Ratio D: ${(calcs.gaugeDisagreementRatio * 100).toFixed(1)}%)` : ''}
                </div>
              </div>

              {/* Current Data-Confidence State */}
              <div className="metric-box">
                <div className="metric-label" style={{ marginBottom: '0.35rem' }}>Local Data Confidence</div>
                <div>{getConfidenceBadge(latestEval?.confidence || 'INSUFFICIENT')}</div>
                <div className="metric-subtext" style={{ marginTop: '0.35rem' }}>
                  Timestamp: {latestEval?.timestamp ? new Date(latestEval.timestamp).toUTCString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Middle Section: Ground vs Satellite & Quality Findings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* Latest Conduit vs Satellite Comparison */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <GitCompare size={16} color="var(--accent-teal)" /> Latest Conduit vs Satellite Comparison
                  </h3>
                  <Link href="/comparison" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                    View Comparison <ArrowRight size={12} />
                  </Link>
                </div>

                {latestComparison ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                      <div className="metric-box">
                        <div className="metric-label">Quality-Screened Ground</div>
                        <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                          {latestComparison.qualityScreenedPassed && latestComparison.groundRainfallMm !== null
                            ? `${latestComparison.groundRainfallMm} mm`
                            : 'Deferred'}
                        </div>
                      </div>

                      <div className="metric-box">
                        <div className="metric-label">CHIRPS Satellite Grid</div>
                        <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                          {latestComparison.chirpsRainfallMm} mm
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)', lineHeight: 1.45 }}>
                      <strong>Interpretation:</strong> {latestComparison.interpretation}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">No comparison data available for recent dates.</div>
                )}
              </div>

              {/* Rationale & Quality Control Rule Findings */}
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} color="var(--accent-teal)" /> Quality Control Rationale
                  </h3>
                  <Link href="/evidence" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                    View Evidence <ArrowRight size={12} />
                  </Link>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)', marginBottom: '0.85rem', lineHeight: 1.45 }}>
                  {latestEval?.explanation || 'No confidence evaluation available.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {checks.slice(0, 4).map((chk: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem 0.65rem',
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{chk.checkName}</span>
                      {chk.passed ? (
                        <span className="badge badge-pass" style={{ fontSize: '0.65rem' }}>PASS</span>
                      ) : (
                        <span className="badge badge-warn" style={{ fontSize: '0.65rem' }}>FLAG</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section: Decision Support & Operator Actions Log */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ClipboardList size={16} color="var(--accent-teal)" /> Recent Decision & Operator Action Status
                </h3>
                <Link href="/action-log" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                  View Decision Log <ArrowRight size={12} />
                </Link>
              </div>

              {actionSuccess && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.85rem', fontSize: '0.8rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle size={14} /> {actionSuccess}
                </div>
              )}

              {/* Quick Record Action Form */}
              {latestEval && (
                <form onSubmit={handleQuickAction} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', minWidth: 140 }}>
                    Log Action for Obs <code>{latestEval.observationId}</code>:
                  </div>

                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      fontSize: '0.8rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      background: '#ffffff',
                    }}
                  >
                    <option value="ACCEPT_OBSERVATION">Accept observation</option>
                    <option value="MARK_FOR_REVIEW">Mark for review</option>
                    <option value="REQUEST_INSPECTION">Request inspection</option>
                    <option value="ACKNOWLEDGE_MISMATCH">Acknowledge mismatch</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Enter decision rationale..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      minWidth: 200,
                      padding: '0.4rem 0.65rem',
                      fontSize: '0.8rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-medium)',
                      background: '#ffffff',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={submittingAction || !actionReason.trim()}
                    className="btn btn-primary"
                  >
                    <Send size={12} /> Record Action
                  </button>
                </form>
              )}

              {/* Action Log Table */}
              {recentActions.length === 0 ? (
                <div className="empty-state">No decision log actions recorded yet.</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Observation ID</th>
                        <th>Action</th>
                        <th>Decision Rationale</th>
                        <th>Operator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActions.map((act) => (
                        <tr key={act.id}>
                          <td>{new Date(act.timestamp).toUTCString()}</td>
                          <td><code>{act.observationId}</code></td>
                          <td>
                            <span className="badge badge-pass" style={{ fontSize: '0.7rem' }}>
                              {act.action}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-main)', maxWidth: 380 }}>
                            {act.reasonContext}
                          </td>
                          <td style={{ color: 'var(--text-light)' }}>{act.operatorName}</td>
                        </tr>
                      ))}
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
