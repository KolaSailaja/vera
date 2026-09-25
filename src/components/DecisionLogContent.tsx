'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import {
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Send,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';

export function DecisionLogContent() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form state
  const [obsIdInput, setObsIdInput] = useState('');
  const [actionInput, setActionInput] = useState<string>('ACCEPT_OBSERVATION');
  const [reasonInput, setReasonInput] = useState('');
  const [operatorInput, setOperatorInput] = useState('Duty Operator');

  const fetchActions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/actions');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setActions(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch action log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const handleRecordAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsIdInput.trim() || !reasonInput.trim()) return;

    setSubmitting(true);
    setFormSuccess(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observationId: obsIdInput.trim(),
          action: actionInput,
          reasonContext: reasonInput.trim(),
          operatorName: operatorInput.trim() || 'Operator',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFormSuccess(`Operator action "${actionInput}" saved to database.`);
        setObsIdInput('');
        setReasonInput('');
        await fetchActions();
      } else {
        alert(`Error saving action: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Failed to submit action: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'ACCEPT_OBSERVATION':
        return (
          <span className="badge badge-trustworthy" style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>
            <CheckCircle size={12} /> ACCEPT OBSERVATION
          </span>
        );
      case 'MARK_FOR_REVIEW':
        return (
          <span className="badge badge-disagreement" style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>
            ⚡ MARK FOR REVIEW
          </span>
        );
      case 'REQUEST_INSPECTION':
        return (
          <span
            className="badge badge-disagreement"
            style={{
              fontSize: '0.8rem',
              padding: '0.3rem 0.65rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ⚠ REQUEST INSPECTION
          </span>
        );
      case 'ACKNOWLEDGE_MISMATCH':
      default:
        return (
          <span
            className="badge"
            style={{
              fontSize: '0.8rem',
              padding: '0.3rem 0.65rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            ACKNOWLEDGE MISMATCH
          </span>
        );
    }
  };

  return (
    <>
      <Header title="Operator Action Log & Decision Support" />

      <main className="content-body">
        {/* Record New Action Form Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ClipboardList size={20} color="var(--accent-teal)" />
            <h2 className="card-title" style={{ margin: 0 }}>
              Record Operator Action
            </h2>
          </div>
          <p className="card-description">
            Persist a formal operator action and decision rationale in the SQLite audit log.
          </p>

          {formSuccess && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: 'var(--status-trustworthy)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle size={16} /> {formSuccess}
            </div>
          )}

          <form onSubmit={handleRecordAction} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Observation ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. obs_1727140000000"
                  value={obsIdInput}
                  onChange={(e) => setObsIdInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Action Type *
                </label>
                <select
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="ACCEPT_OBSERVATION">Accept observation</option>
                  <option value="MARK_FOR_REVIEW">Mark for review</option>
                  <option value="REQUEST_INSPECTION">Request inspection</option>
                  <option value="ACKNOWLEDGE_MISMATCH">Acknowledge mismatch</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 500 }}>
                  Operator Name
                </label>
                <input
                  type="text"
                  placeholder="Operator Name"
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 500 }}>
                Reason & Decision Context *
              </label>
              <textarea
                placeholder="Explain the physical evidence, rationale, or context for this action..."
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                required
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.56rem 0.75rem',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting || !obsIdInput.trim() || !reasonInput.trim()}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                {submitting ? (
                  <>Saving Action...</>
                ) : (
                  <>
                    <Send size={14} /> Record Operator Action
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Action History Log Table Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>
                Operator Action Audit History
              </h3>
              <p className="card-description">
                Persistent audit trail of decision support actions recorded by station operators.
              </p>
            </div>

            <button onClick={fetchActions} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Refresh Log
            </button>
          </div>

          {loading ? (
            <LoadingState message="Loading persistent operator action log from database..." />
          ) : actions.length === 0 ? (
            <div className="empty-state">
              No operator actions recorded yet. Use the form above or evidence views to record an action.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Observation ID</th>
                    <th>Operator Action</th>
                    <th>Reason / Decision Context</th>
                    <th>Operator Name</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((act) => (
                    <tr key={act.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                          <Clock size={13} color="var(--text-secondary)" />
                          <strong>{new Date(act.timestamp).toUTCString()}</strong>
                        </div>
                      </td>
                      <td>
                        <code>{act.observationId}</code>
                      </td>
                      <td>{getActionBadge(act.action)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)', maxWidth: '380px', lineHeight: 1.4 }}>
                        {act.reasonContext}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <User size={13} /> {act.operatorName}
                        </div>
                      </td>
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
