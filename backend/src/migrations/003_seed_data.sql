-- ============================================================
-- SEED DATA — run once after migrations to populate demo data
-- ============================================================

-- Blood Banks (India sample locations)
INSERT INTO blood_banks (name, address, city, location_lat, location_lng, contact_number, operating_hours)
VALUES
  ('City Blood Bank', '12 MG Road', 'Delhi', 28.6139, 77.2090, '+91-11-23456789', 'Mon-Sat 8am-8pm'),
  ('Red Cross Blood Centre', '45 Park Street', 'Mumbai', 19.0760, 72.8777, '+91-22-98765432', 'Mon-Sun 9am-6pm'),
  ('LifeLine Blood Bank', '78 Anna Salai', 'Chennai', 13.0827, 80.2707, '+91-44-11223344', 'Mon-Fri 8am-5pm'),
  ('Sanjeevani Blood Bank', '23 Residency Road', 'Bangalore', 12.9716, 77.5946, '+91-80-55667788', 'Mon-Sat 7am-9pm'),
  ('Jeevan Blood Centre', '56 Hazratganj', 'Lucknow', 26.8467, 80.9462, '+91-522-9988776', 'Mon-Sun 8am-7pm')
ON CONFLICT DO NOTHING;

-- Donation Camps (upcoming dates)
INSERT INTO donation_camps (name, organizer, camp_date, camp_time, venue, address, location_lat, location_lng, goodies)
VALUES
  ('Mega Blood Drive 2026', 'Red Cross Society', '2026-04-10', '09:00 AM', 'Community Hall, Sector 5', 'Sector 5, Delhi', 28.6200, 77.2100, 'T-shirt, refreshments, certificate'),
  ('Save a Life Camp', 'Rotary Club Delhi', '2026-04-15', '10:00 AM', 'Town Hall', 'Connaught Place, Delhi', 28.6315, 77.2167, 'Juice, snacks, donor card'),
  ('Youth Blood Donation Drive', 'NSS Unit - DU', '2026-04-20', '08:30 AM', 'Delhi University Campus', 'North Campus, Delhi', 28.6880, 77.2090, 'Certificate, refreshments'),
  ('Corporate Blood Camp', 'TCS Foundation', '2026-05-05', '09:00 AM', 'TCS Office Lobby', 'BKC, Mumbai', 19.0650, 72.8680, 'Gift hamper, certificate'),
  ('Community Health Drive', 'Lions Club', '2026-05-12', '10:00 AM', 'Lions Club Hall', 'Andheri, Mumbai', 19.1136, 72.8697, 'Snacks, donor kit'),
  ('College Blood Drive', 'IIT Madras NSS', '2026-05-18', '09:00 AM', 'IIT Madras Campus', 'Adyar, Chennai', 12.9915, 80.2337, 'T-shirt, refreshments'),
  ('Annual Donation Camp', 'Kasganj Health Dept', '2026-04-25', '08:00 AM', 'District Hospital', 'Civil Lines, Kasganj', 27.8100, 78.6400, 'Certificate, snacks')
ON CONFLICT DO NOTHING;

-- Hospital account (password: Hospital@123)
-- bcrypt hash of "Hospital@123" with 10 rounds
-- To regenerate: node -e "const b=require('bcrypt');b.hash('Hospital@123',10).then(console.log)"
INSERT INTO hospitals (name, email, password_hash, address, location_lat, location_lng, contact_number)
VALUES (
  'City General Hospital',
  'hospital@demo.com',
  '$2b$10$P/95h67dJE.XvOjy0MAD7uhD/QRuwxL9UpTgAdyvFe2uzOKNK2Rni',
  '1 Hospital Road, Delhi',
  28.6200,
  77.2100,
  '+91-11-99887766'
)
ON CONFLICT (email) DO NOTHING;

-- Rewards for blood banks
INSERT INTO rewards (blood_bank_id, reward_name, description, eligibility_condition)
SELECT id, 'First Donation Badge', 'Awarded on your very first donation', '1 donation'
FROM blood_banks WHERE name = 'City Blood Bank'
ON CONFLICT DO NOTHING;

INSERT INTO rewards (blood_bank_id, reward_name, description, eligibility_condition)
SELECT id, 'Life Saver Certificate', 'Certificate of appreciation for 5 donations', '5 donations'
FROM blood_banks WHERE name = 'Red Cross Blood Centre'
ON CONFLICT DO NOTHING;

INSERT INTO rewards (blood_bank_id, reward_name, description, eligibility_condition)
SELECT id, 'Hero Donor T-Shirt', 'Exclusive BloodConnect T-shirt for 10 donations', '10 donations'
FROM blood_banks WHERE name = 'LifeLine Blood Bank'
ON CONFLICT DO NOTHING;
