-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Admin account (email: mk5429864@gmail.com, password: Manisha_0913)
INSERT INTO admins (email, password_hash, full_name)
VALUES (
  'mk5429864@gmail.com',
  '$2b$10$aUmVs1CnxJ9gDJcFnSD9G.R2OR95NFXGSTlKdPiy7WRjWVZygpAtC',
  'Manisha Kumar'
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name;
