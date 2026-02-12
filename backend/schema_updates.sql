-- Shifts Table: Stores weekly schedule for employees
create table if not exists shifts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) not null,
  day_of_week text not null check (day_of_week in ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')),
  start_time time not null,
  end_time time not null,
  center_lat float not null,
  center_lng float not null,
  radius float default 200, -- in meters
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Attendance Logs Table: Stores check-in/check-out sessions
create table if not exists attendance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) not null,
  check_in_time timestamp with time zone not null default timezone('utc'::text, now()),
  check_out_time timestamp with time zone,
  status text check (status in ('active', 'completed', 'emergency_out')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Policies (Open access for Service Role / Backend)
alter table shifts enable row level security;
alter table attendance_logs enable row level security;

create policy "Allow all access for service role" on shifts for all using (true);
create policy "Allow all access for service role" on attendance_logs for all using (true);
