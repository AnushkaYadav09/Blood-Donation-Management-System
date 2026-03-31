# BloodConnect — Blood Donation Management System

A web-based platform that connects blood donors with nearby blood banks. 
Donors can register, check eligibility, track donation history, and receive 
reminders. Blood banks can manage rewards and camps.

## Tech Stack
- Frontend: React 18 + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL 14 with PostGIS
- Auth: JWT + Google OAuth
- Email: Nodemailer (Gmail SMTP)
- Deployment: Docker + Nginx

## Features
- Donor registration with age, phone, and password validation
- Pre-donation health eligibility screening
- Location-based blood bank discovery with map view
- Donation history tracking and next eligible date calculation
- Automated donation reminder notifications
- Rewards display per blood bank
- Google Sign-In support

## Quick Start
```bash
docker-compose up --build
