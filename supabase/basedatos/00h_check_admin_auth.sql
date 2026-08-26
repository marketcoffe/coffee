-- Check if admin_users.id matches auth.users.id
SELECT run_query_text(
  'SELECT a.id::text as admin_id, a.email FROM admin_users a WHERE a.email = ''kecho8a@gmail.com'''
);

-- Check if that ID exists in auth.users
SELECT run_query_text(
  'SELECT id::text, email FROM auth.users WHERE email = ''kecho8a@gmail.com'''
);

-- Compare: do they match?
SELECT run_query_text(
  'SELECT 
    (SELECT id::text FROM admin_users WHERE email = ''kecho8a@gmail.com'') as admin_uid,
    (SELECT id::text FROM auth.users WHERE email = ''kecho8a@gmail.com'') as auth_uid,
    CASE WHEN (SELECT id FROM admin_users WHERE email = ''kecho8a@gmail.com'') = 
              (SELECT id FROM auth.users WHERE email = ''kecho8a@gmail.com'') 
         THEN ''MATCH'' ELSE ''MISMATCH'' END as status'
);
