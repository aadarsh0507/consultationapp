import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Modal, Alert, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FaFilePdf, FaFileExcel, FaFilter, FaArrowLeft, FaPlay } from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { consultationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Report = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    patientName: '',
    doctorName: '',
    uhidId: ''
  });
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await consultationAPI.getAll();
      if (response.success) {
        setConsultations(response.data);
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

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const applyFilters = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await consultationAPI.getAll(filters);
      if (response.success) {
        setConsultations(response.data);
      } else {
        setError(response.message || 'Failed to apply filters');
      }
    } catch (err) {
      setError('Failed to apply filters');
      console.error('Error applying filters:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.autoTable({
      head: [['Date', 'Patient Name', 'UHID', 'Doctor', 'Attender', 'ICU Consultant', 'Duration']],
      body: consultations.map(item => [
        new Date(item.date).toLocaleDateString(),
        item.patientName,
        item.uhidId,
        item.doctorName,
        item.attenderName,
        item.icuConsultantName,
        `${item.recordingDuration} seconds`
      ]),
    });
    doc.save('consultation_report.pdf');
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(consultations.map(item => ({
      Date: new Date(item.date).toLocaleDateString(),
      'Patient Name': item.patientName,
      UHID: item.uhidId,
      Doctor: item.doctorName,
      Attender: item.attenderName,
      'ICU Consultant': item.icuConsultantName,
      Duration: `${item.recordingDuration} seconds`,
      Status: item.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consultations');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'consultation_report.xlsx');
  };

  const handleVideoClick = (consultation) => {
    setCurrentVideo(consultation);
    setShowVideoModal(true);
  };

  return (
    <Container className="py-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="shadow-lg border-0" style={{ 
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}>
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <Button
                variant="link"
                onClick={() => navigate('/home')}
                className="text-decoration-none"
              >
                <FaArrowLeft className="me-2" />
                Back to Home
              </Button>
              <div>
                <Button
                  variant="outline-primary"
                  className="me-2"
                  onClick={exportToPDF}
                  disabled={loading || consultations.length === 0}
                >
                  <FaFilePdf className="me-2" />
                  Export PDF
                </Button>
                <Button
                  variant="outline-success"
                  onClick={exportToExcel}
                  disabled={loading || consultations.length === 0}
                >
                  <FaFileExcel className="me-2" />
                  Export Excel
                </Button>
              </div>
            </div>

            <h3 className="mb-4">Consultation Reports</h3>

            {error && (
              <Alert variant="danger" className="mb-4">
                {error}
              </Alert>
            )}

            <Card className="mb-4">
              <Card.Body>
                <h5 className="mb-3">
                  <FaFilter className="me-2" />
                  Filters
                </h5>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Date From</Form.Label>
                      <Form.Control
                        type="date"
                        name="dateFrom"
                        value={filters.dateFrom}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Date To</Form.Label>
                      <Form.Control
                        type="date"
                        name="dateTo"
                        value={filters.dateTo}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Patient Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="patientName"
                        value={filters.patientName}
                        onChange={handleFilterChange}
                        placeholder="Search patient"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Doctor Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="doctorName"
                        value={filters.doctorName}
                        onChange={handleFilterChange}
                        placeholder="Search doctor"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>UHID</Form.Label>
                      <Form.Control
                        type="text"
                        name="uhidId"
                        value={filters.uhidId}
                        onChange={handleFilterChange}
                        placeholder="Search UHID"
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Button
                  variant="primary"
                  onClick={applyFilters}
                  disabled={loading}
                >
                  Apply Filters
                </Button>
              </Card.Body>
            </Card>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Loading consultations...</p>
              </div>
            ) : consultations.length === 0 ? (
              <Alert variant="info">
                No consultations found. Try adjusting your filters.
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Patient Name</th>
                      <th>UHID</th>
                      <th>Doctor</th>
                      <th>Attender</th>
                      <th>ICU Consultant</th>
                      <th>Duration</th>
                      <th>Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((consultation) => (
                      <tr key={consultation._id}>
                        <td>{new Date(consultation.date).toLocaleDateString()}</td>
                        <td>{consultation.patientName}</td>
                        <td>{consultation.uhidId}</td>
                        <td>{consultation.doctorName}</td>
                        <td>{consultation.attenderName}</td>
                        <td>{consultation.icuConsultantName}</td>
                        <td>{consultation.recordingDuration} seconds</td>
                        <td>
                          <Button
                            variant="link"
                            className="p-0"
                            onClick={() => handleVideoClick(consultation)}
                          >
                            <FaPlay className="text-primary" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            <Modal show={showVideoModal} onHide={() => setShowVideoModal(false)} size="lg">
              <Modal.Header closeButton>
                <Modal.Title>
                  {currentVideo?.patientName} - {currentVideo?.uhidId}
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="ratio ratio-16x9">
                  <video 
                    src={`/uploads/${currentVideo?.videoFileName}`}
                    controls 
                    autoPlay
                    style={{ width: '100%', height: '100%' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowVideoModal(false)}>
                  Close
                </Button>
              </Modal.Footer>
            </Modal>
          </Card.Body>
        </Card>
      </motion.div>
    </Container>
  );
};

export default Report; 