-- Create Attendance Sessions Table
create table if not exists public.attendance_sessions (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  created_by uuid references public.profiles(id),
  is_active boolean default true,
  expires_at timestamp with time zone,
  mom_url text, -- URL to the PDF in storage
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on sessions
alter table public.attendance_sessions enable row level security;

-- Policies for sessions
create policy "Anyone authenticated can view sessions" on public.attendance_sessions
  for select using (auth.role() = 'authenticated');

create policy "Admins/Mentors can create sessions" on public.attendance_sessions
  for insert with check (
    exists (
      select 1 from public.profiles where user_id = auth.uid() and role in ('MENTOR', 'COMMITTEE')
    )
  );

create policy "Admins/Mentors can update sessions" on public.attendance_sessions
  for update using (
    exists (
      select 1 from public.profiles where user_id = auth.uid() and role in ('MENTOR', 'COMMITTEE')
    )
  );

-- Create Faculty View Tokens Table
create table if not exists public.faculty_view_tokens (
  id uuid default gen_random_uuid() primary key,
  faculty_name text not null,
  faculty_email text,
  token text not null unique,
  expires_at timestamp with time zone not null,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on tokens
alter table public.faculty_view_tokens enable row level security;

create policy "Admins can manage tokens" on public.faculty_view_tokens
  for all using (
    exists (
      select 1 from public.profiles where user_id = auth.uid() and role in ('MENTOR', 'COMMITTEE')
    )
  );

-- Update Attendance Table to link with sessions
alter table public.attendance 
add column if not exists session_id uuid references public.attendance_sessions(id) on delete cascade;

-- Update Attendance Policy for QR scanning
-- Allow users to insert if they are authenticated (for QR scanning)
drop policy if exists "Users can mark their own attendance" on public.attendance;
create policy "Users can mark their own attendance" on public.attendance
  for insert with check (auth.uid() = user_id);

-- Storage Bucket Setup for MOMs
insert into storage.buckets (id, name, public) 
values ('moms', 'moms', true)
on conflict (id) do nothing;

-- Storage policies need to be distinct or they will conflict if run multiple times
drop policy if exists "Admins can upload MOMs" on storage.objects;
create policy "Admins can upload MOMs" on storage.objects
  for insert with check (
    bucket_id = 'moms' and 
    exists (
      select 1 from public.profiles where user_id = auth.uid() and role in ('MENTOR', 'COMMITTEE')
    )
  );

drop policy if exists "Authenticated users can view MOMs" on storage.objects;
create policy "Authenticated users can view MOMs" on storage.objects
  for select using (
    bucket_id = 'moms' and 
    auth.role() = 'authenticated'
  );

-- RPC Function for Faculty Access (Security Definer to bypass RLS)
create or replace function public.get_faculty_dashboard(token_input text)
returns json
language plpgsql
security definer
as $$
declare
  token_record record;
  result json;
begin
  -- Check token validity
  select * into token_record from public.faculty_view_tokens
  where token = token_input and expires_at > now();

  if token_record is null then
    return json_build_object('error', 'Invalid or expired token');
  end if;

  -- Fetch sessions
  select json_build_object(
    'faculty_name', token_record.faculty_name,
    'sessions', (
      select json_agg(s) from (
        select 
          id, 
          title, 
          description, 
          mom_url, 
          created_at,
          (select count(*) from public.attendance where session_id = id) as attendee_count
        from public.attendance_sessions
        order by created_at desc
      ) s
    )
  ) into result;

  return result;
end;
$$;

-- Grant execute to public/anon so faculty can call it
grant execute on function public.get_faculty_dashboard(text) to anon;
grant execute on function public.get_faculty_dashboard(text) to authenticated;
