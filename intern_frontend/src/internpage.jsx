import React, { useState } from 'react';
import './internpage.css';
import logo from './assets/logo1.webp';
import axios from 'axios';

const Internpage = () => {
  const [formData, setFormData] = useState({
    studentName: '',
    rollNumber: '',
    companyName: '',
    position: '',
    duration: '',
    startDate: '',
    endDate: '',
    description: '',
    tutorEmail: '', // New field for tutor email
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to submit internship details.');
      return;
    }

    const submissionData = {
      company_name: formData.companyName,
      role: formData.position,
      start_date: formData.startDate,
      end_date: formData.endDate,
      supervisor_name: formData.studentName, // Adjust mapping as needed
      supervisor_email: '', // Add logic to get supervisor email (e.g., from user data or form)
      tutor_email: formData.tutorEmail, // Include tutor email from form
      description: formData.description,
      document_url: null, // Add file upload logic if needed
    };

    try {
      const response = await axios.post('http://localhost:3000/submissions', submissionData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Submission Response:', response.data);
      setSuccess('Internship details submitted successfully!');
      setFormData({
        studentName: '',
        rollNumber: '',
        companyName: '',
        position: '',
        duration: '',
        startDate: '',
        endDate: '',
        description: '',
        tutorEmail: '', // Reset tutor email
      });
    } catch (err) {
      console.error('Submission Error:', err.response?.data || err.message);
      setError('Failed to submit internship details: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="img-container">
          <img src={logo} alt="logo" />
          <h1>PSG TECH</h1>
        </div>
      </header>

      <main className="main-content">
        <div className="form-container">
          <h2>Internship Details Form</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="studentName"
              placeholder="Student Name"
              value={formData.studentName}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="rollNumber"
              placeholder="Roll Number"
              value={formData.rollNumber}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="companyName"
              placeholder="Company Name"
              value={formData.companyName}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="position"
              placeholder="Position"
              value={formData.position}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="duration"
              placeholder="Duration (e.g., 2 months)"
              value={formData.duration}
              onChange={handleChange}
              required
            />
            <label>Start Date:</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
            <label>End Date:</label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
            <input
              type="email"
              name="tutorEmail"
              placeholder="Tutor Email"
              value={formData.tutorEmail}
              onChange={handleChange}
              required
            />
            <textarea
              name="description"
              placeholder="Brief description of the internship"
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
            <button type="submit">Submit</button>
            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
          </form>
        </div>
      </main>

      <footer className="footer">Footer</footer>
    </div>
  );
};

export default Internpage;