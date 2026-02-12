import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map, Users, Clock, Save, Plus, LogOut, Search, Calendar, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const LocationMarker = ({ setCenter }) => {
    useMapEvents({
        click(e) {
            setCenter(e.latlng);
        },
    });
    return null;
};

// Component to recenter map when zone center changes
const MapRecenter = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center.lat !== 0 && center.lng !== 0) {
            map.setView([center.lat, center.lng], map.getZoom());
        }
    }, [center.lat, center.lng, map]);
    return null;
};

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('map');
    const [zone, setZone] = useState({ center: { lat: 0, lng: 0 }, radius: 100 });
    const [checkIns, setCheckIns] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const navigate = useNavigate();

    // User Creation State
    const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'employee' });

    const [users, setUsers] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [newShift, setNewShift] = useState({ userId: '', dayOfWeek: 'Lundi', startTime: '09:00', endTime: '17:00', center: { lat: 0, lng: 0 }, radius: 200 });
    const [liveStatus, setLiveStatus] = useState([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Search for places using Nominatim (OpenStreetMap) API
    const handleSearch = async (query) => {
        const searchText = query || searchQuery;
        if (!searchText || searchText.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&limit=5`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );
            const data = await response.json();
            console.log('Search results:', data);
            setSearchResults(data || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // Auto-search as user types (debounced)
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            handleSearch(searchQuery);
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Select a search result
    const selectSearchResult = (result) => {
        setZone(prev => ({
            ...prev,
            center: { lat: parseFloat(result.lat), lng: parseFloat(result.lon) }
        }));
        setSearchResults([]);
        setSearchQuery('');
    };

    useEffect(() => {
        loadUsers();
        // loadZone(); // Optional: Global zone might be deprecated or kept
        loadCheckIns();
        // Load live status if tracking
        if (activeTab === 'tracking') {
            loadLiveStatus();
            const interval = setInterval(loadLiveStatus, 10000);
            return () => clearInterval(interval);
        }
    }, [activeTab, date]);

    const loadUsers = async () => {
        try {
            const res = await api.get('/users?role=employee'); // Assuming we can filter or just get all
            // If API doesn't support filter, filter here.
            // Actually /users is currently Create only? No, I need a GET /users endpoint in Backend or I can use Supabase client directly check
            // Let's assume I check the 'users' table via the API I'll add or just use the generic response
            // Wait, I didn't add GET /api/users. I did add GET /api/attendance/live which returns users.
            // I'll use /api/attendance/live to get users list for the dropdown for now or add GET /users.
            const statusRes = await api.get('/attendance/live');
            setUsers(statusRes.data);
        } catch (err) { console.error(err); }
    };

    const loadLiveStatus = async () => {
        try {
            const res = await api.get('/attendance/live');
            setLiveStatus(res.data);
        } catch (err) { console.error(err); }
    };

    const handleAddShift = async () => {
        try {
            await api.post('/shifts', newShift);
            alert('Shift added successfully');
            // Refresh shifts
        } catch (err) { alert('Failed to add shift'); }
    };

    // Get user's current location on first load
    useEffect(() => {
        if (zone.center.lat === 0 && zone.center.lng === 0) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setZone(prev => ({
                        ...prev,
                        center: {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }
                    }));
                },
                (error) => {
                    console.log('Geolocation error:', error);
                    // Default to a visible location if geolocation fails
                    setZone(prev => ({
                        ...prev,
                        center: { lat: 33.5731, lng: -7.5898 } // Casablanca, Morocco
                    }));
                }
            );
        }
    }, []);

    const loadZone = async () => {
        try {
            const res = await api.get('/zone');
            if (res.data && res.data.center) {
                setZone(res.data);
            }
        } catch (err) { console.error(err); }
    };

    const loadCheckIns = async () => {
        try {
            const res = await api.get(`/checkins?date=${date}`);
            setCheckIns(res.data);
        } catch (err) { console.error(err); }
    };

    const saveZone = async () => {
        try {
            await api.post('/zone', zone);
            alert('Zone updated successfully');
        } catch (err) { alert('Failed to update zone'); }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', newUser);
            alert(`User ${newUser.username} created!`);
            setNewUser({ username: '', email: '', password: '', role: 'employee' });
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create user');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Inter', sans-serif" }}>
            {/* Sidebar */}
            <div style={{ width: '250px', background: '#ffffff', borderRight: '1px solid #e0e0e0', padding: '1rem' }}>
                <h2 style={{ color: '#1a73e8', marginBottom: '2rem', paddingLeft: '1rem' }}>Admin Panel</h2>

                <nav>
                    <button
                        onClick={() => setActiveTab('map')}
                        style={{ ...navButtonStyle, background: activeTab === 'map' ? '#e8f0fe' : 'transparent', color: activeTab === 'map' ? '#1a73e8' : '#333' }}
                    >
                        <Map size={20} style={{ marginRight: '10px' }} /> Zone Config
                    </button>
                    <button
                        onClick={() => setActiveTab('planning')}
                        style={{ ...navButtonStyle, background: activeTab === 'planning' ? '#e8f0fe' : 'transparent', color: activeTab === 'planning' ? '#1a73e8' : '#333' }}
                    >
                        <Calendar size={20} style={{ marginRight: '10px' }} /> Planning
                    </button>
                    <button
                        onClick={() => setActiveTab('tracking')}
                        style={{ ...navButtonStyle, background: activeTab === 'tracking' ? '#e8f0fe' : 'transparent', color: activeTab === 'tracking' ? '#1a73e8' : '#333' }}
                    >
                        <Activity size={20} style={{ marginRight: '10px' }} /> Tracking Live
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{ ...navButtonStyle, background: activeTab === 'history' ? '#e8f0fe' : 'transparent', color: activeTab === 'history' ? '#1a73e8' : '#333' }}
                    >
                        <Clock size={20} style={{ marginRight: '10px' }} /> Rapports Journaliers
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{ ...navButtonStyle, background: activeTab === 'users' ? '#e8f0fe' : 'transparent', color: activeTab === 'users' ? '#1a73e8' : '#333' }}
                    >
                        <Users size={20} style={{ marginRight: '10px' }} /> User Management
                    </button>
                </nav>

                <button onClick={handleLogout} style={{ ...navButtonStyle, marginTop: 'auto', color: '#dc3545' }}>
                    <LogOut size={20} style={{ marginRight: '10px' }} /> Logout
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '2rem' }}>
                {activeTab === 'map' && (
                    <div style={cardStyle}>
                        <h2 style={{ marginBottom: '1rem' }}>Geofencing Zone</h2>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Radius: {zone.radius}m</label>
                            <input
                                type="range"
                                min="10"
                                max="1000"
                                value={zone.radius}
                                onChange={(e) => setZone({ ...zone, radius: Number(e.target.value) })}
                                style={{ width: '100%', marginTop: '0.5rem' }}
                            />
                        </div>

                        {/* Search Box */}
                        <div style={{ marginBottom: '1rem', position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Search for a place (e.g., Marché de Gros)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        background: '#1a73e8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Search size={18} />
                                </button>
                            </div>

                            {/* Search Results Dropdown */}
                            {searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    marginTop: '4px',
                                    zIndex: 9999,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    maxHeight: '300px',
                                    overflowY: 'auto'
                                }}>
                                    {searchResults.map((result, index) => (
                                        <div
                                            key={index}
                                            onClick={() => selectSearchResult(result)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                cursor: 'pointer',
                                                borderBottom: index < searchResults.length - 1 ? '1px solid #f0f0f0' : 'none',
                                                fontSize: '0.9rem'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                                            onMouseLeave={(e) => e.target.style.background = 'white'}
                                        >
                                            {result.display_name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <MapContainer center={[zone.center.lat || 0, zone.center.lng || 0]} zoom={15} style={{ height: '100%', width: '100%' }}>
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <MapRecenter center={zone.center} />
                                {zone.center.lat !== 0 && <Circle center={[zone.center.lat, zone.center.lng]} radius={zone.radius} pathOptions={{ color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.2 }} />}
                                <LocationMarker setCenter={(latlng) => setZone({ ...zone, center: latlng })} />
                            </MapContainer>
                        </div>
                        <button onClick={saveZone} style={primaryButtonStyle}><Save size={18} style={{ marginRight: '8px' }} /> Save Configuration</button>
                    </div>
                )}

                {activeTab === 'planning' && (
                    <div style={cardStyle}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Configuration du Planning (Par Employé)</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>1. Sélectionner l'employé à configurer</label>
                                <select
                                    style={{ ...inputStyle, width: '100%' }}
                                    value={newShift.userId}
                                    onChange={(e) => setNewShift({ ...newShift, userId: e.target.value })}
                                >
                                    <option value="">-- Choisir un employé --</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username}</option>
                                    ))}
                                </select>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>2. Définir l'horaire</label>
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        <div>
                                            <label>Jour</label>
                                            <select
                                                style={{ ...inputStyle, width: '100%' }}
                                                value={newShift.dayOfWeek}
                                                onChange={(e) => setNewShift({ ...newShift, dayOfWeek: e.target.value })}
                                            >
                                                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label>Début</label>
                                                <input type="time" style={{ ...inputStyle, width: '100%' }} value={newShift.startTime} onChange={e => setNewShift({ ...newShift, startTime: e.target.value })} />
                                            </div>
                                            <div>
                                                <label>Fin</label>
                                                <input type="time" style={{ ...inputStyle, width: '100%' }} value={newShift.endTime} onChange={e => setNewShift({ ...newShift, endTime: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>3. Définir la Zone GPS (Cliquer sur la carte)</label>
                                <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #ddd' }}>
                                    <MapContainer center={[33.5731, -7.5898]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer
                                            attribution='&copy; OpenStreetMap'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        <LocationMarker setCenter={(latlng) => setNewShift({ ...newShift, center: { lat: latlng.lat, lng: latlng.lng } })} />
                                        {newShift.center.lat !== 0 && (
                                            <Circle
                                                center={[newShift.center.lat, newShift.center.lng]}
                                                radius={newShift.radius}
                                                pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.2 }}
                                            />
                                        )}
                                    </MapContainer>
                                </div>
                                <label>Rayon (m): {newShift.radius}</label>
                                <input type="range" min="50" max="1000" value={newShift.radius} onChange={e => setNewShift({ ...newShift, radius: Number(e.target.value) })} style={{ width: '100%' }} />
                            </div>
                        </div>
                        <button onClick={handleAddShift} style={{ ...primaryButtonStyle, marginTop: '2rem', width: '100%' }}>
                            Ajouter ce quart de travail
                        </button>
                    </div>
                )}

                {activeTab === 'tracking' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ marginBottom: 0 }}>Tracking Live</h2>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Auto-refresh: 10s</span>
                        </div>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {liveStatus.map(u => (
                                <div key={u.id} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: u.isOnline ? '#f0fff4' : '#fff' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{u.username}</h3>
                                        <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.9rem' }}>
                                            Last Location: {u.lastLocation ? `${u.lastLocation.lat.toFixed(4)}, ${u.lastLocation.lng.toFixed(4)}` : 'Inconnu'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: u.isOnline ? '#28a745' : '#6c757d' }}></div>
                                        <span style={{ fontWeight: '500', color: u.isOnline ? '#28a745' : '#6c757d' }}>
                                            {u.isOnline ? 'En Ligne' : 'Hors ligne'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div style={cardStyle}>
                        <h2 style={{ marginBottom: '1.5rem' }}>Create New User</h2>
                        <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '1rem', maxWidth: '500px' }}>
                            <input
                                type="text" placeholder="Full Name"
                                value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                required style={inputStyle}
                            />
                            <input
                                type="email" placeholder="Email Address"
                                value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                required style={inputStyle}
                            />
                            <input
                                type="password" placeholder="Password"
                                value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                required style={inputStyle}
                            />
                            <select
                                value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="employee">Employee</option>
                                <option value="admin">Administrator</option>
                            </select>
                            <button type="submit" style={primaryButtonStyle}><Plus size={18} style={{ marginRight: '8px' }} /> Create User</button>
                        </form>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2>Check-Ins</h2>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem' }}>User</th>
                                    <th style={{ padding: '0.75rem' }}>Time</th>
                                    <th style={{ padding: '0.75rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {checkIns.map(ci => (
                                    <tr key={ci._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '0.75rem' }}>{ci.userId?.username}</td>
                                        <td style={{ padding: '0.75rem' }}>{new Date(ci.timestamp).toLocaleTimeString()}</td>
                                        <td style={{ padding: '0.75rem', color: ci.status === 'in_zone' ? 'green' : 'red' }}>{ci.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const navButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '8px',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    textAlign: 'left'
};

const cardStyle = {
    background: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
};

const inputStyle = {
    padding: '0.75rem',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem'
};

const primaryButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 1.5rem',
    background: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600'
};

export default AdminDashboard;
