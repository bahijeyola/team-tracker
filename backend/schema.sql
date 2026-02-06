-- Create Users Table
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  username text not null,
  email text unique not null,
  password text not null, -- Stores hashed password (bcrypt)
  role text check (role in ('admin', 'employee')) default 'employee',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create Zones Table
create table if not exists zones (
  id uuid default gen_random_uuid() primary key,
  center_lat float not null,
  center_lng float not null,
  radius float default 100,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create CheckIns Table
create table if not exists checkins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) not null,
  lat float not null,
  lng float not null,
  photo text,
  status text check (status in ('in_zone', 'out_of_zone')),
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) - Optional for Backend-only Access but good practice
alter table users enable row level security;
alter table zones enable row level security;
alter table checkins enable row level security;

-- Policies (Open access for Service Role / Backend)
create policy "Allow all access for service role" on users for all using (true);
create policy "Allow all access for service role" on zones for all using (true);
create policy "Allow all access for service role" on checkins for all using (true);
