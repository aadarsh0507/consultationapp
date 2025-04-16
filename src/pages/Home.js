import React, { useState, useRef, useEffect } from 'react';
import { Container, Form, Button, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaIdCard, FaUserMd, FaUserNurse, FaVideo, FaStop, FaArrowLeft, FaSignOutAlt, FaFileAlt, FaCog } from 'react-icons/fa';
import { consultationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [consultations, setConsultations] = useState([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await consultationAPI.getAll();
      if (response.success) {
        // Sort consultations by date (newest first)
        const sortedConsultations = response.data.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        setConsultations(sortedConsultations);
      } else {
        setError(response.message || 'Failed to fetch consultations');
      }
    } catch (err) {
      setError('Failed to fetch consultations');
      console.error('Error fetching consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const startRecording = async () => {
    try {
      // Validate form data before starting recording
      const requiredFields = ['patientName', 'uhidId', 'attenderName', 'icuConsultantName', 'doctorName'];
      const emptyFields = requiredFields.filter(field => !formData[field]);
      
      if (emptyFields.length > 0) {
        setError(`Please fill in all required fields: ${emptyFields.join(', ')}`);
        return;
      }

      // Show video container before requesting camera access
      setShowVideo(true);

      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      if (!stream) {
        throw new Error('Could not access camera or microphone');
      }

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Error initializing camera');
        });
      }

      // Set up media recorder with better quality settings
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('Recording stopped, chunks collected:', chunksRef.current.length);
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setError('');
      setSuccess('Recording started...');

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Recording error:', err);
      setError(`Error starting recording: ${err.message}`);
      setIsRecording(false);
      setShowVideo(false);
      
      // Clean up if there was an error
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
        // Stop recording and timer
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
        
        // Stop all tracks
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

        // Wait for the last chunk to be collected
        await new Promise(resolve => {
          mediaRecorderRef.current.onstop = resolve;
        });

        if (chunksRef.current.length === 0) {
          throw new Error('No video data was recorded');
        }

        // Create blob from recorded chunks
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fileName = `consultation_${Date.now()}_${formData.uhidId}.webm`;

        // Save file locally
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'WebM Video',
              accept: { 'video/webm': ['.webm'] }
            }]
          });

          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          setSuccess('Video saved successfully!');
        } catch (saveError) {
          console.error('Error saving file:', saveError);
          if (saveError.name !== 'AbortError') {
            setError('Error saving video file. Please try again.');
          }
        }

        // Save consultation data to MongoDB
        const consultationData = {
          patientName: formData.patientName,
          uhidId: formData.uhidId,
          doctor: user?._id,
          doctorName: formData.doctorName,
          attenderName: formData.attenderName,
          icuConsultantName: formData.icuConsultantName,
          videoFileName: fileName,
          date: new Date().toISOString(),
          recordingDuration: recordingTime,
          status: 'completed'
        };

        // Save to MongoDB
        const response = await consultationAPI.create(consultationData);
        
        if (!response.data) {
          throw new Error('Failed to save consultation data to database');
        }

        setSuccess('Consultation recorded and saved successfully!');
        
        // Reset form and states
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

        // Refresh consultations list
        await fetchConsultations();
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
                            onClick={() => navigate('/storage-settings')}
                            className="d-flex align-items-center"
                          >
                            <FaCog className="me-2" />
                            Storage Settings
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          onClick={() => navigate('/report')}
                          className="me-2 d-flex align-items-center"
                        >
                          <FaFileAlt className="me-2" />
                          Reports
                        </Button>
                        <Button
                          variant="outline-danger"
                          onClick={handleLogout}
                          className="d-flex align-items-center"
                        >
                          <FaSignOutAlt className="me-2" />
                          Logout
                        </Button>
                      </motion.div>
                    </div>

                    <AnimatePresence mode="wait">
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
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