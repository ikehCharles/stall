-- Create a default admin user
-- Note: This is for demo purposes. In production, admin users should be created through proper channels
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@stallbook.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "System Administrator"}',
    false,
    'authenticated'
) ON CONFLICT (email) DO NOTHING;

-- Insert admin role for the admin user
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'admin'::app_role 
FROM auth.users 
WHERE email = 'admin@stallbook.com'
ON CONFLICT (user_id, role) DO NOTHING;