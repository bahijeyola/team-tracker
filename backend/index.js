require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check routes
app.get('/', (req, res) => res.send('TeamTracker Backend is running!'));
app.get('/api', (req, res) => res.send('API is accessible at /api/login, /api/zone, etc.'));

// Routes

// 1. Auth: Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create User
app.post('/api/users', async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { data, error } = await supabase
            .from('users')
            .insert([{ username, email, password: hashedPassword, role }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Zone: Get and Set
app.get('/api/zone', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "Row not found"

        // Format for frontend (center: { lat, lng })
        if (data) {
            res.json({
                center: { lat: data.center_lat, lng: data.center_lng },
                radius: data.radius
            });
        } else {
            res.json({ center: { lat: 0, lng: 0 }, radius: 100 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/zone', async (req, res) => {
    const { center, radius } = req.body;
    try {
        const { data, error } = await supabase
            .from('zones')
            .insert([{
                center_lat: center.lat,
                center_lng: center.lng,
                radius
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. CheckIn: Submit and List
app.post('/api/checkin', async (req, res) => {
    const { userId, coords, photo, status } = req.body;
    try {
        const { data, error } = await supabase
            .from('checkins')
            .insert([{
                user_id: userId,
                lat: coords.lat,
                lng: coords.lng,
                photo,
                status
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/checkins', async (req, res) => {
    const { date } = req.query;
    try {
        let query = supabase
            .from('checkins')
            .select('*, users(username)')
            .order('timestamp', { ascending: false });

        if (date) {
            const startStr = date;
            const startDate = new Date(startStr);
            const endDate = new Date(startStr);
            endDate.setDate(startDate.getDate() + 1);

            // Supabase filter
            query = query
                .gte('timestamp', startDate.toISOString())
                .lt('timestamp', endDate.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        // Map response to match frontend expectation (userId: { username })
        const formatted = data.map(ci => ({
            ...ci,
            userId: ci.users // Supabase join returns object/array based on relationship
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Shifts: Create, Get, Delete
app.post('/api/shifts', async (req, res) => {
    const { userId, dayOfWeek, startTime, endTime, center, radius } = req.body;
    try {
        const { data, error } = await supabase
            .from('shifts')
            .insert([{
                user_id: userId,
                day_of_week: dayOfWeek,
                start_time: startTime,
                end_time: endTime,
                center_lat: center.lat,
                center_lng: center.lng,
                radius
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shifts', async (req, res) => {
    const { userId } = req.query;
    try {
        let query = supabase.from('shifts').select('*, users(username)');
        if (userId) query = query.eq('user_id', userId);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shifts/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('shifts')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Shift deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Attendance: Check-in, Check-out, Emergency, Live Location
// Helper to calculate distance in meters
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 1000; // Distance in m
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

app.post('/api/attendance/checkin', async (req, res) => {
    const { userId, coords, dayOfWeek, time } = req.body; // coords: { lat, lng }

    // Default current time if not provided (for robustness)
    const now = new Date();
    // Logic: Look for a shift for this user, today, that covers current time (optional) OR just location matches ANY valid shift for today.
    // Simplifying: User selects "Monday" shift or system infers it.
    // Let's infer from current day name if not provided.
    // But user might check in a bit early.
    // Requirement: "employee do the checkin based in the location if that's is included u can start the work"

    try {
        // 1. Get user Shifts for today (or all)
        // Note: day_of_week in DB is 'Lundi', 'Mardi'... Frontend sends French day or we convert.
        // Let's assume frontend sends correct day string for now or we query all.

        const { data: shifts, error: shiftError } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', userId);

        if (shiftError) throw shiftError;

        // 2. Validate Location against ANY valid shift (or specific one)
        let matchedShift = null;
        for (let shift of shifts) {
            const dist = getDistanceFromLatLonInM(coords.lat, coords.lng, shift.center_lat, shift.center_lng);
            if (dist <= shift.radius) {
                matchedShift = shift;
                break;
            }
        }

        if (!matchedShift) {
            return res.status(403).json({ error: 'You are not not inside any assigned shift location.' });
        }

        // 3. Create Attendance Log
        const { data, error } = await supabase
            .from('attendance_logs')
            .insert([{
                user_id: userId,
                status: 'active',
                check_in_time: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        // 4. Also log a checkin point for history
        await supabase.from('checkins').insert([{
            user_id: userId,
            lat: coords.lat,
            lng: coords.lng,
            status: 'in_zone'
        }]);

        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/attendance/checkout', async (req, res) => {
    const { userId, status, attendanceId } = req.body; // status can be 'completed' or 'emergency_out'
    try {
        // Find latest active attendance if id not provided
        let matchQuery = supabase
            .from('attendance_logs')
            .update({
                check_out_time: new Date().toISOString(),
                status: status || 'completed'
            })
            .eq('user_id', userId)
            .is('check_out_time', null); // Only close active sessions

        const { data, error } = await matchQuery.select();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/attendance/location', async (req, res) => {
    const { userId, coords } = req.body;
    try {
        const { data, error } = await supabase
            .from('checkins')
            .insert([{
                user_id: userId,
                lat: coords.lat,
                lng: coords.lng,
                status: 'in_zone' // Assuming they are safe if they haven't checked out
            }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/attendance/live', async (req, res) => {
    try {
        // Get all users and their latest attendance log + latest checkin
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, role');

        if (error) throw error;

        // For each user, get latest active attendance
        const report = await Promise.all(users.map(async (u) => {
            const { data: logs } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('user_id', u.id)
                .is('check_out_time', null)
                .order('created_at', { ascending: false })
                .limit(1);

            const { data: lastPing } = await supabase
                .from('checkins')
                .select('*')
                .eq('user_id', u.id)
                .order('timestamp', { ascending: false })
                .limit(1);

            return {
                ...u,
                isOnline: logs && logs.length > 0,
                lastStatus: logs && logs.length > 0 ? logs[0].status : 'offline',
                lastLocation: lastPing && lastPing.length > 0 ? { lat: lastPing[0].lat, lng: lastPing[0].lng } : null
            };
        }));

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
