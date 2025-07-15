import React, { useState, useEffect } from 'react';
import './ReviewPage.css'; // Unique CSS file
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const ReviewPage = () => {
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to access reviews.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get('http://localhost:3000/submissions/pending', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPendingSubmissions(response.data.submissions || []);
      } catch (err) {
        console.error('Fetch Error:', err.response?.data || err.message);
        setError('Failed to load pending submissions: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleReview = async (e) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    const token = localStorage.getItem('token');
    try {
      await axios.patch(
        `http://localhost:3000/submissions/${selectedSubmission.id}/decision`, // Updated to /decision
        {
          status: e.target.status.value, // Use the selected value directly
          remarks: remarks || undefined, // Use undefined for optional remarks
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPendingSubmissions((prev) =>
        prev.filter((sub) => sub.id !== selectedSubmission.id)
      );
      setSelectedSubmission(null);
      setRemarks('');
      setError(''); // Clear error on success
    } catch (err) {
      console.error('Review Error:', err.response?.data || err.message);
      setError('Failed to review submission: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="rp-app-container">
      <header className="rp-header">
        <div className="rp-img-container">
          <img src="/assets/logo1.webp" alt="logo" />
          <h1>PSG TECH</h1>
        </div>
        <Link to="/staffpage" className="rp-back-button">Back to Staff Page</Link>
      </header>
      <main className="rp-main-content">
        <div className="rp-profile-container">
          <h2 className="rp-profile-title">Review Submissions</h2>
          {loading ? (
            <p className="rp-loading">Loading...</p>
          ) : error ? (
            <p className="rp-error">{error}</p>
          ) : (
            <>
              {pendingSubmissions.length === 0 ? (
                <p className="rp-no-data">No pending submissions.</p>
              ) : (
                <div className="rp-profile-details">
                  <ul className="rp-submissions-list">
                    {pendingSubmissions.map((submission) => (
                      <li
                        key={submission.id}
                        className="rp-submission-item"
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        {submission.company_name} - {submission.role} ({submission.start_date} to {submission.end_date})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedSubmission && (
                <form className="rp-edit-form" onSubmit={handleReview}>
                  <h3 className="rp-modal-title">Review Submission</h3>
                  <p><strong>Student:</strong> {selectedSubmission.supervisor_name}</p>
                  <p><strong>Company:</strong> {selectedSubmission.company_name}</p>
                  <p><strong>Role:</strong> {selectedSubmission.role}</p>
                  <p><strong>Dates:</strong> {selectedSubmission.start_date} to {selectedSubmission.end_date}</p>
                  <textarea
                    className="rp-remarks-input"
                    name="remarks"
                    placeholder="Add remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <select name="status" className="rp-status-select" defaultValue="">
                    <option value="" disabled>Select Action</option>
                    <option value="accepted">Accept</option> {/* Updated to match backend */}
                    <option value="declined">Decline</option> {/* Updated to match backend */}
                  </select>
                  <button type="submit" className="rp-submit-button">Submit Review</button>
                  {error && <p className="rp-error">{error}</p>}
                </form>
              )}
            </>
          )}
        </div>
      </main>
      <footer className="rp-footer">Footer</footer>
    </div>
  );
};

export default ReviewPage;