'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { LoadingState } from '@/components/LoadingState';
import { Lightbulb, MessageSquare, Check, RefreshCw, Send } from 'lucide-react';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Operator Feedback Modal State
  const [activeRec, setActiveRec] = useState<any>(null);
  const [operatorName, setOperatorName] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('AGREE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rRes, fRes] = await Promise.all([
        fetch('/api/recommendations'),
        fetch('/api/operator-feedback'),
      ]);

      const rJson = await rRes.json();
      const fJson = await fRes.json();

      if (rJson.success) setRecommendations(rJson.data || []);
      if (fJson.success) setFeedbackList(fJson.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRec || !operatorName.trim()) return;

    setSubmitting(true);
    setFeedbackMsg('');
    try {
      const res = await fetch('/api/operator-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'RECOMMENDATION',
          targetId: activeRec.id,
          operatorName,
          feedbackStatus,
          notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg('Operator feedback recorded in database.');
        setNotes('');
        await loadData();
        setTimeout(() => {
          setActiveRec(null);
          setFeedbackMsg('');
        }, 1200);
      } else {
        setFeedbackMsg(`Error: ${json.message || 'Submission failed'}`);
      }
    } catch (err: any) {
      setFeedbackMsg(`Error: ${err?.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header title="Evidence-Based Recommendations & Operator Feedback" />

      <main className="content-body">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="card-title">Actionable Environmental Recommendations</h2>
              <p className="card-description">
                Data-trust guidelines, ground truth validation score, and field operator feedback history.
              </p>
            </div>
            <button onClick={loadData} className="btn btn-secondary">
              <RefreshCw size={15} /> Refresh List
            </button>
          </div>

          {loading ? (
            <LoadingState message="Fetching data-trust recommendations..." />
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              No recommendations available. Run data ingestion to evaluate station performance.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station ID</th>
                    <th>Actionable Recommendation</th>
                    <th>Evidence Summary</th>
                    <th>Trust Score</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.date}</strong></td>
                      <td><code>{rec.stationId}</code></td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '280px' }}>
                        {rec.actionableRecommendation}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        {rec.evidenceSummary}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              rec.trustScore >= 0.8
                                ? 'var(--status-trustworthy)'
                                : rec.trustScore >= 0.5
                                ? 'var(--status-disagreement)'
                                : 'var(--status-faulty)',
                          }}
                        >
                          {(rec.trustScore * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-insufficient">{rec.status}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => setActiveRec(rec)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          <MessageSquare size={13} /> Log Feedback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Feedback History Card */}
        {feedbackList.length > 0 && (
          <div className="card">
            <h3 className="card-title">Submitted Operator Feedback Log</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Feedback ID</th>
                    <th>Operator Name</th>
                    <th>Target ID</th>
                    <th>Evaluation</th>
                    <th>Notes</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.map((fb) => (
                    <tr key={fb.id}>
                      <td><code>{fb.id}</code></td>
                      <td><strong>{fb.operatorName}</strong></td>
                      <td><code>{fb.targetId}</code></td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              fb.feedbackStatus === 'AGREE'
                                ? 'var(--status-trustworthy)'
                                : fb.feedbackStatus === 'DISAGREE'
                                ? 'var(--status-faulty)'
                                : 'var(--status-disagreement)',
                          }}
                        >
                          {fb.feedbackStatus}
                        </span>
                      </td>
                      <td>{fb.notes || '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fb.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Operator Feedback Modal */}
        {activeRec && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '520px',
                background: 'var(--bg-secondary)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              }}
            >
              <h3 className="card-title" style={{ marginBottom: '0.25rem' }}>
                Submit Operator Feedback
              </h3>
              <p className="card-description">
                Station: <strong>{activeRec.stationId}</strong> ({activeRec.date})
              </p>

              <form onSubmit={handleSubmitFeedback}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Operator Name / ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="e.g. Eng. Jane Doe (JKUAT Hydrology)"
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Evaluation Decision *
                  </label>
                  <select
                    value={feedbackStatus}
                    onChange={(e) => setFeedbackStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="AGREE">AGREE (Confirm recommendation)</option>
                    <option value="DISAGREE">DISAGREE (Flag for review)</option>
                    <option value="INCONCLUSIVE">INCONCLUSIVE (Requires field visit)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Field Notes & Observations
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add field inspection notes or bucket calibration readings..."
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                {feedbackMsg && (
                  <div
                    style={{
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      color: feedbackMsg.startsWith('Error') ? 'var(--status-faulty)' : 'var(--status-trustworthy)',
                    }}
                  >
                    {feedbackMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setActiveRec(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
