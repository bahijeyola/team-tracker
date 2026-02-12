import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api';

const EmployeeDashboard = () => {
    const [status, setStatus] = useState('Loading...');
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    // Polling interval for live tracking
    const trackingInterval = useRef(null);

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        checkStatus();

        // Watch location
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLocation(coords);
                // If checked in, sync location
                if (isCheckedIn) {
                    api.post('/attendance/location', { userId: user.id, coords }).catch(console.error);
                }
            },
            (err) => setError('Geolocation error: ' + err.message),
            { enableHighAccuracy: true }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
            if (trackingInterval.current) clearInterval(trackingInterval.current);
        };
    }, [isCheckedIn]);

    const checkStatus = async () => {
        try {
            const res = await api.get('/attendance/live');
            const myStatus = res.data.find(u => u.id === user.id);
            if (myStatus && myStatus.isOnline) {
                setIsCheckedIn(true);
                setStatus('Currently Checked In');
            } else {
                setIsCheckedIn(false);
                setStatus('Ready to Check In');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const [showCamera, setShowCamera] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            alert('Camera Error: ' + err.message);
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    const switchCamera = () => {
        stopCamera();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    // Restart camera when facingMode changes
    useEffect(() => {
        if (showCamera) {
            startCamera();
        }
    }, [facingMode]);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Get base64 string
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compress to 0.7 quality
            setPhoto(dataUrl);
            stopCamera();
        }
    };

    const handleCheckIn = async () => {
        if (!location) {
            alert('Waiting for location...');
            return;
        }
        if (!photo) {
            alert('Photo is required for check-in.');
            return;
        }

        const dayOfWeek = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
        const dayFormatted = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

        try {
            await api.post('/attendance/checkin', {
                userId: user.id,
                coords: location,
                dayOfWeek: dayFormatted,
                photo: photo
            });
            setIsCheckedIn(true);
            setStatus('Checked In Successfully');
            setPhoto(null); // Reset photo
            alert('Welcome! You are checked in.');
        } catch (err) {
            alert('Check-in Failed: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCheckOut = async (isEmergency = false) => {
        try {
            await api.post('/attendance/checkout', {
                userId: user.id,
                status: isEmergency ? 'emergency_out' : 'completed'
            });
            setIsCheckedIn(false);
            setStatus('Checked Out');
            alert(isEmergency ? 'Emergency Check-out Recorded' : 'Goodbye! Checked out successfully.');
        } catch (err) {
            alert('Check-out failed');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/', { replace: true });
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '2rem', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Hello, {user?.username}</h1>
                        <p style={{ margin: '0.5rem 0 0', color: '#666' }}>Employee Dashboard</p>
                    </div>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <LogOut size={16} style={{ marginRight: '6px' }} /> Logout
                    </button>
                </div>

                {error && (
                    <div style={{ background: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                        <AlertCircle size={20} style={{ marginRight: '10px' }} />
                        {error}
                    </div>
                )}

                <div style={{ background: isCheckedIn ? '#d4edda' : '#e2e3e5', color: isCheckedIn ? '#155724' : '#383d41', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'center' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isCheckedIn ? <CheckCircle size={24} style={{ marginRight: '10px' }} /> : <MapPin size={24} style={{ marginRight: '10px' }} />}
                        {status}
                    </h2>
                    {location && <p style={{ margin: '1rem 0 0', fontSize: '0.9rem' }}>Current Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>}
                </div>

                {!isCheckedIn ? (
                    <div>
                        {/* Camera UI - Inline */}
                        {showCamera && (
                            <div style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                                <div style={{ position: 'relative', height: '300px' }}>
                                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
                                        <button onClick={stopCamera} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                        <div
                                            onClick={capturePhoto}
                                            style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'white', border: '3px solid rgba(255,255,255,0.5)', cursor: 'pointer' }}
                                        ></div>
                                        <button onClick={switchCamera} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Flip</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Photo Preview & Check In Actions */}
                        {!photo ? (
                            !showCamera && (
                                <button
                                    onClick={startCamera}
                                    disabled={!location}
                                    style={{ width: '100%', padding: '1rem', background: location ? '#1a73e8' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: location ? 'pointer' : 'not-allowed' }}
                                >
                                    {location ? 'OPEN CAMERA & CHECK IN' : user ? 'Locating...' : 'Loading...'}
                                </button>
                            )
                        ) : (
                            <div style={{ textAlign: 'center' }}>
                                <img src={photo} alt="Check-in Self" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '1rem', border: '2px solid #ddd' }} />
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <button onClick={handleCheckIn} style={{ width: '100%', padding: '1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer' }}>
                                        CONFIRM CHECK IN
                                    </button>
                                    <button onClick={() => setPhoto(null)} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}>
                                        Retake Photo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <button
                            onClick={() => handleCheckOut(false)}
                            style={{ width: '100%', padding: '1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                            CHECK OUT
                        </button>
                        <button
                            onClick={() => handleCheckOut(true)}
                            style={{ width: '100%', padding: '1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                            EMERGENCY CHECK OUT
                        </button>
                        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>
                            Your location is being tracked live while checked in.
                        </p>
                    </div>
                )}

            </div>
        </div >
    );
};

export default EmployeeDashboard;
