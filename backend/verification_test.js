const API_URL = 'http://localhost:5001/api';

async function testBackend() {
    try {
        console.log('--- Testing Backend APIs ---');

        // Helper for fetch
        const post = async (endpoint, body) => {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok && res.status !== 403) { // 403 is expected for invalid checkin
                const text = await res.text();
                throw new Error(`Status ${res.status}: ${text}`);
            }
            return res;
        };

        const get = async (endpoint) => {
            const res = await fetch(`${API_URL}${endpoint}`);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return res.json();
        };

        // 1. Health Check
        try {
            const data = await get('');
            console.log('✅ API Reachable:', data);
        } catch (e) {
            console.error('❌ API Not Reachable. Is server running? Error:', e.message);
            // return; // Continue to try other endpoints? No, probably fail.
        }

        // 2. Create User (if needed, or use existing)
        let userId;
        try {
            const data = await get('/attendance/live');
            if (data.length > 0) {
                userId = data[0].id;
                console.log('ℹ️ Using User:', data[0].username, userId);
            } else {
                console.log('⚠️ No users found. Creating temp user...');
                const res = await post('/users', {
                    username: 'Test User',
                    email: 'test' + Date.now() + '@example.com',
                    password: 'password123',
                    role: 'employee'
                });
                const user = await res.json();
                userId = user.id;
                console.log('✅ Created Temp User:', userId);
            }
        } catch (e) {
            console.error('❌ Failed to get/create user:', e.message);
            return;
        }

        // 3. Create Shift
        // Location: "0, 0" with radius 1000m for easy testing
        const center = { lat: 0, lng: 0 };
        try {
            const res = await post('/shifts', {
                userId,
                dayOfWeek: 'Lundi',
                startTime: '00:00',
                endTime: '23:59',
                center,
                radius: 1000
            });
            const shift = await res.json();
            console.log('✅ Shift Created:', shift.id);
        } catch (e) {
            console.error('❌ Failed to create shift:', e.message);
        }

        // 4. Check In (Valid)
        try {
            const res = await post('/attendance/checkin', {
                userId,
                coords: { lat: 0.0001, lng: 0.0001 }, // Inside 1000m radius
                dayOfWeek: 'Lundi'
            });
            const data = await res.json();
            console.log('✅ Check-In (Valid) Success:', data.status);
        } catch (e) {
            console.error('❌ Check-In (Valid) Failed:', e.message);
        }

        // 5. Check In (Invalid)
        try {
            const res = await post('/attendance/checkin', {
                userId,
                coords: { lat: 10, lng: 10 }, // Far away
                dayOfWeek: 'Lundi'
            });
            if (res.status === 403) {
                console.log('✅ Check-In (Invalid) correctly rejected (403)');
            } else {
                console.error('❌ Check-In (Invalid) Unexpectedly Succeeded or failed with wrong status:', res.status);
            }
        } catch (e) {
            console.error('❌ Check-In (Invalid) Error:', e.message);
        }

        // 6. Live Status
        try {
            const data = await get('/attendance/live');
            const myStatus = data.find(u => u.id === userId);
            console.log('✅ Live Status Checked. Online:', myStatus?.isOnline);
        } catch (e) {
            console.error('❌ Failed to get live status');
        }

        // 7. Check Out
        try {
            const res = await post('/attendance/checkout', {
                userId,
                status: 'completed'
            });
            console.log('✅ Check-Out Success');
        } catch (e) {
            console.error('❌ Check-Out Failed:', e.message);
        }

        console.log('--- Verification Complete ---');

    } catch (err) {
        console.error('Unexpected Error:', err);
    }
}

testBackend();
