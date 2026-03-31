-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Donors table
CREATE TABLE IF NOT EXISTS donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group VARCHAR(3) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  location_city VARCHAR(100),
  is_available BOOLEAN DEFAULT true,
  allow_hospital_contact BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT true,
  sms_notifications_enabled BOOLEAN DEFAULT true,
  reminder_notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  failed_login_attempts INT DEFAULT 0,
  account_locked_until TIMESTAMP
);

-- Blood banks table
CREATE TABLE IF NOT EXISTS blood_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  contact_number VARCHAR(20),
  operating_hours VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donation records table
CREATE TABLE IF NOT EXISTS donation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  blood_bank_id UUID NOT NULL REFERENCES blood_banks(id),
  donation_date DATE NOT NULL,
  volume_donated INT NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards table
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_bank_id UUID NOT NULL REFERENCES blood_banks(id) ON DELETE CASCADE,
  reward_name VARCHAR(255) NOT NULL,
  description TEXT,
  eligibility_condition VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donation camps table
CREATE TABLE IF NOT EXISTS donation_camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  organizer VARCHAR(255) NOT NULL,
  camp_date DATE NOT NULL,
  camp_time VARCHAR(50),
  venue VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  goodies TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  contact_number VARCHAR(20),
  failed_login_attempts INT DEFAULT 0,
  account_locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact requests table
CREATE TABLE IF NOT EXISTS contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

-- Earned rewards table
CREATE TABLE IF NOT EXISTS earned_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  donation_record_id UUID NOT NULL REFERENCES donation_records(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Camp registrations table
CREATE TABLE IF NOT EXISTS camp_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES donation_camps(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_donors_email ON donors(email);
CREATE INDEX IF NOT EXISTS idx_donors_blood_group ON donors(blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_location ON donors USING GIST(ST_MakePoint(location_lng, location_lat));
CREATE INDEX IF NOT EXISTS idx_donation_records_donor ON donation_records(donor_id);
CREATE INDEX IF NOT EXISTS idx_donation_records_date ON donation_records(donation_date);
CREATE INDEX IF NOT EXISTS idx_blood_banks_location ON blood_banks USING GIST(ST_MakePoint(location_lng, location_lat));
CREATE INDEX IF NOT EXISTS idx_donation_camps_date ON donation_camps(camp_date);
CREATE INDEX IF NOT EXISTS idx_contact_requests_donor ON contact_requests(donor_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_hospital ON contact_requests(hospital_id);
