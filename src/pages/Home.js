import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // ✅ FIXED
import { useAuth } from '../context/AuthContext';



import { Container, Row, Col, Card, Button, Form, Alert } from 'react-bootstrap';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

// React Icons
import { FaCog, FaFileAlt, FaSignOutAlt, FaUser, FaIdCard, FaUserNurse, FaUserMd, FaVideo, FaStop } from 'react-icons/fa';
import { consultationAPI } from '../services/api';

const Home = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [formData, setFormData] = useState({
    patientName: '',
    uhidId: '',
    attenderName: '',
    icuConsultantName: '',
    doctorName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [storagePath, setStoragePath] = useState('');
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [consultations, setConsultations] = useState([]);
  const [storageSettings, setStorageSettings] = useState({
    path: '',
    maxSize: 1024, // in MB
    allowedTypes: ['webm', 'mp4']
  });

  // Fetch storage path when component mounts
  useEffect(() => {
    const fetchStoragePath = async () => {
      try {
        const response = await axios.get('https://consultation-backend-nmyg.onrender.com/get-storage-path');
        if (response.data && response.data.path) {
          setStoragePath(response.data.path);
        }
      } catch (error) {
        console.error('Error fetching storage path:', error);
      }
    };

    fetchStoragePath();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const startRecording = async () => {
    try {
      const requiredFields = ['patientName', 'uhidId', 'attenderName', 'icuConsultantName', 'doctorName'];
      const emptyFields = requiredFields.filter(field => !formData[field]);
      if (emptyFields.length > 0) {
        setError(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        return;
      }

      setShowVideo(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Error initializing camera');
        });
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setError('');
      setSuccess('Recording started...');

      startTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        const elapsedTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsedTime);
      }, 1000);

    } catch (err) {
      console.error('Recording error:', err);
      setError(`Error starting recording: ${err.message}`);
      setIsRecording(false);
      setShowVideo(false);
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      setLoading(true);
      setError('');
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
        timerRef.current = null;
        startTimeRef.current = null;

        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

        await new Promise(resolve => {
          mediaRecorderRef.current.onstop = resolve;
        });

        if (chunksRef.current.length === 0) {
          throw new Error('No video data was recorded');
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fileName = `consultation_${Date.now()}_${formData.uhidId}.webm`;

        // Create FormData with the video and storage path
        const uploadFormData = new FormData();
        uploadFormData.append('videoFile', blob, fileName);
        uploadFormData.append('storagePath', storagePath);

        console.log('Uploading video to path:', storagePath);

        // Upload the video to the backend
        const uploadResponse = await axios.post('https://consultation-backend-nmyg.onrender.com/save-video', uploadFormData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (!uploadResponse.data.success) {
          throw new Error('Failed to upload video');
        }

        console.log('Video uploaded successfully:', uploadResponse.data);

        const consultationData = {
          patientName: formData.patientName,
          uhidId: formData.uhidId,
          doctor: user.id,
          doctorName: formData.doctorName,
          attenderName: formData.attenderName,
          icuConsultantName: formData.icuConsultantName,
          videoFileName: fileName,
          date: new Date().toISOString(),
          recordingDuration: recordingTime,
          status: 'completed'
        };

        console.log('Sending consultation data:', consultationData);

        // Send consultation data to the backend
        try {
          const response = await consultationAPI.create(consultationData);
          console.log('Consultation API response:', response);
          
          if (response && response.data) {
            setSuccess('Consultation recorded and saved successfully!');
          } else {
            throw new Error('Failed to save consultation: Invalid response format');
          }
        } catch (apiError) {
          console.error('Consultation API error:', apiError);
          throw new Error(apiError.response?.data?.message || 'Failed to save consultation data');
        }

        // Clear form and state
        setFormData({
          patientName: '',
          uhidId: '',
          attenderName: '',
          icuConsultantName: '',
          doctorName: ''
        });
        setShowVideo(false);
        setRecordingTime(0);
        chunksRef.current = [];

      } catch (err) {
        console.error('Error saving consultation:', err);
        setError(err.response?.data?.message || err.message || 'Error saving consultation. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    logout();
    navigate('/doctor-login');
  };

  const handleStorageSettings = async () => {
    if (user?.role !== 'admin') return;
    
    try {
      const response = await axios.post('https://consultation-backend-nmyg.onrender.com/update-storage-path', {
        newStoragePath: storagePath
      });
      
      if (response.data.success) {
        setSuccess('Storage path updated successfully');
        setShowStorageSettings(false);
      }
    } catch (err) {
      setError('Failed to update storage path');
    }
  };

  return (
    <div className="min-vh-100" style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Container className="py-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Row className="justify-content-center">
            <Col md={8} lg={6}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Card className="shadow-lg border-0" style={{ 
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                      >
                        <h3 className="mb-0">New Consultation</h3>
                        <p className="text-muted">Record a new patient consultation</p>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="d-flex gap-2"
                      >
                        {user?.role === 'admin' && (
                          <Button
                            variant="outline-primary"
                            onClick={() => setShowStorageSettings(!showStorageSettings)}
                            className="me-2"
                          >
                            <FaCog className="me-2" />
                            Storage Settings
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          onClick={() => navigate('/report')}
                          className="me-2"
                        >
                          <FaFileAlt className="me-2" />
                          Reports
                        </Button>
                        <Button
                          variant="outline-danger"
                          onClick={handleLogout}
                        >
                          <FaSignOutAlt className="me-2" />
                          Logout
                        </Button>
                      </motion.div>
                    </div>

                    {showStorageSettings && user?.role === 'admin' && (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="mb-4 p-3 border rounded"
  >
    <h5>Storage Settings</h5>
    <Form.Group className="mb-3">
      <Form.Label>Current Storage Path</Form.Label>
      <Form.Control
        type="text"
        value={storagePath}
        onChange={(e) => setStoragePath(e.target.value)}
        placeholder="Enter storage path"
      />
      <Form.Text className="text-muted">
        Current path where videos are being stored
      </Form.Text>
    </Form.Group>
    <Button variant="primary" onClick={handleStorageSettings}>
      Update Path
    </Button>
  </motion.div>
)}


                    <AnimatePresence mode="sync">
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          key="error"
                        >
                          <Alert variant="danger" className="mb-4">
                            {error}
                          </Alert>
                        </motion.div>
                      )}
                      {success && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          key="success"
                        >
                          <Alert variant="success" className="mb-4">
                            {success}
                          </Alert>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Form>
                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                      >
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-bold">Patient Name</Form.Label>
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                              <FaUser className="text-primary" />
                            </span>
                            <Form.Control
                              type="text"
                              name="patientName"
                              value={formData.patientName}
                              onChange={handleChange}
                              placeholder="Enter patient name"
                              required
                              disabled={isRecording}
                              className="border-start-0"
                              style={{ height: '50px' }}
                            />
                          </div>
                        </Form.Group>
                      </motion.div>

                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.5 }}
                      >
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-bold">UHID</Form.Label>
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                              <FaIdCard className="text-primary" />
                            </span>
                            <Form.Control
                              type="text"
                              name="uhidId"
                              value={formData.uhidId}
                              onChange={handleChange}
                              placeholder="Enter UHID"
                              required
                              disabled={isRecording}
                              className="border-start-0"
                              style={{ height: '50px' }}
                            />
                          </div>
                        </Form.Group>
                      </motion.div>

                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                      >
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-bold">Attender Name</Form.Label>
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                              <FaUserNurse className="text-primary" />
                            </span>
                            <Form.Control
                              type="text"
                              name="attenderName"
                              value={formData.attenderName}
                              onChange={handleChange}
                              placeholder="Enter attender name"
                              required
                              disabled={isRecording}
                              className="border-start-0"
                              style={{ height: '50px' }}
                            />
                          </div>
                        </Form.Group>
                      </motion.div>

                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.9, duration: 0.5 }}
                      >
                        <Form.Group className="mb-3">
                          <Form.Label className="fw-bold">Doctor Name</Form.Label>
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                              <FaUserMd className="text-primary" />
                            </span>
                            <Form.Control
                              type="text"
                              name="doctorName"
                              value={formData.doctorName}
                              onChange={handleChange}
                              placeholder="Enter doctor name"
                              required
                              disabled={isRecording}
                              className="border-start-0"
                              style={{ height: '50px' }}
                            />
                          </div>
                        </Form.Group>
                      </motion.div>

                      <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 1, duration: 0.5 }}
                      >
                        <Form.Group className="mb-4">
                          <Form.Label className="fw-bold">ICU Consultant</Form.Label>
                          <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                              <FaUserMd className="text-primary" />
                            </span>
                            <Form.Control
                              type="text"
                              name="icuConsultantName"
                              value={formData.icuConsultantName}
                              onChange={handleChange}
                              placeholder="Enter ICU consultant name"
                              required
                              disabled={isRecording}
                              className="border-start-0"
                              style={{ height: '50px' }}
                            />
                          </div>
                        </Form.Group>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.1, duration: 0.5 }}
                        className="mb-4"
                      >
                        <div className="d-flex justify-content-center gap-3">
                          {!isRecording ? (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                variant="primary"
                                onClick={startRecording}
                                disabled={loading}
                                className="d-flex align-items-center"
                                style={{
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  border: 'none',
                                  padding: '12px 24px',
                                  borderRadius: '10px',
                                  fontSize: '1.1rem',
                                  fontWeight: 'bold'
                                }}
                              >
                                <FaVideo className="me-2" />
                                Start Recording
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button
                                variant="danger"
                                onClick={stopRecording}
                                disabled={loading}
                                className="d-flex align-items-center"
                                style={{
                                  padding: '12px 24px',
                                  borderRadius: '10px',
                                  fontSize: '1.1rem',
                                  fontWeight: 'bold'
                                }}
                              >
                                <FaStop className="me-2" />
                                Stop Recording ({formatTime(recordingTime)})
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>

                      {showVideo && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.5 }}
                          className="mb-4"
                        >
                          <div className="position-relative" style={{ 
                            width: '100%', 
                            height: '300px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              className="w-100 h-100"
                              style={{ 
                                objectFit: 'cover',
                                transform: 'scaleX(-1)' // Mirror the video
                              }}
                            />
                            {isRecording && (
                              <div className="position-absolute top-0 start-0 p-2">
                                <div className="d-flex align-items-center">
                                  <div className="recording-indicator me-2"></div>
                                  <span className="text-white fw-bold">{formatTime(recordingTime)}</span>
                                </div>
                              </div>
                            )}
                            {isRecording && (
                              <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3">
                                <Button
                                  variant="danger"
                                  onClick={stopRecording}
                                  className="d-flex align-items-center"
                                  style={{
                                    padding: '10px 20px',
                                    borderRadius: '50px',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                                  }}
                                >
                                  <FaStop className="me-2" />
                                  Stop Recording
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </Form>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </div>
  );
};

export default Home;