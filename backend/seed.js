require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('./supabaseClient');

const seedAdmin = async () => {
    const email = 'reda.dbbouz@yolafresh.com';

    try {
        // Check if admin exists
        const { data: existing, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existing) {
            console.log('Admin already exists');
        } else {
            console.log('Creating admin...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            const { data, error } = await supabase
                .from('users')
                .insert([
                    {
                        username: 'Reda Dbbouz',
                        email: email,
                        password: hashedPassword,
                        role: 'admin'
                    }
                ])
                .select();

            if (error) throw error;
            console.log(`Admin created: ${email} / admin123`);
        }
    } catch (err) {
        console.error('Error seeding admin:', err.message);
    }
};

seedAdmin();
