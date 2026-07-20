-- FlowCast: businesses + invite-first recipient directory
-- Run this once in the Supabase SQL editor for a new project.

create extension if not exists "pgcrypto";

create table businesses (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  name text not null,
  created_at timestamptz default now()
);

create table recipients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) not null,
  email text not null,
  full_name text,
  auth_user_id uuid unique,       -- Supabase auth.users.id, set once they sign in
  circle_user_id text unique,     -- Circle W3S userId (== recipients.id, kept for clarity)
  wallet_address text unique,     -- Arc wallet address from Circle, set after onboarding
  verification_tier integer default 0 check (verification_tier in (0, 1, 2, 3)),
  status text default 'pending' check (status in ('pending', 'active', 'suspended')),
  invite_token text unique not null,
  invited_at timestamptz default now(),
  onboarded_at timestamptz,
  created_at timestamptz default now()
);

create index on recipients (business_id);
create index on recipients (invite_token);
create index on recipients (auth_user_id);
create index on recipients (email);
