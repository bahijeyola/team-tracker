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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
