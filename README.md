# SaferHoods - Real-time Emergency Response System

## Demo Video
[![DEMO VIDEO](https://img.youtube.com/vi/Ig6gzu5QGTY/0.jpg)](https://www.youtube.com/watch?v=Ig6gzu5QGTY)

## Overview

SaferHoods is an innovative emergency response system prototype, developed during a hackathon.
It is made with single goal of minimizing friction between citizens and Emergency services - featuring real-time communication, location-based reporting, seamless interaction between reporters and authorities, and live tracking.

## Key Features Implemented

- Real-time Incident Reporting: Users can report emergencies via the web app, including real-time location data.
- Live Location Tracking: Authorities can view reported incidents and reporter locations on a map in real-time.
- Two-way Communication (Web App): Reporters can report any incident/communicate with authorities anonymously via:
    - Text Chat: Real-time messaging within an active incident session using Socket.IO.
    - Voice Call: Direct WebRTC-based voice calls between reporter and authority.
- Offline Voice Reporting Hotline:
    - Users can call a designated hotline number to report emergencies in offline mode.
    - Calls are recorded by Twilio.
    - Recordings are automatically sent to an external custom transcription service.
    - The system processes the transcription to attempt automatic incident report creation.
- Interactive Map Interface:
    - Utilizes Leaflet for displaying incident locations.
    - Implements marker clustering to handle numerous incidents efficiently.
- Real-time Notifications:
    - In-app notifications via Socket.IO for events like incoming calls, messages, and status changes.
    - Email notifications sent to relevant parties (e.g., assigned teams, reporters) during the incident processing workflow.
- Incident Management: Basic system for tracking incident status, severity, and assigned teams.

## Technology Stack

### Frontend (Client)
- React.js (with Vite)
- Redux Toolkit for state management
- TailwindCSS for styling
- Leaflet & React-Leaflet for interactive maps
- Socket.IO Client for real-time web communication
- WebRTC for peer-to-peer voice calls
- React Router for navigation

### Backend (Server)
- Node.js with Express.js
- Socket.IO for real-time web communication & signaling
- Supabase for database persistence
- Twilio for Voice API (handling incoming calls, recording)
- Nodemailer for sending email notifications
- external transcription service (whisper model)
- Turf.js for geospatial calculations (e.g., distance)

## Architecture Highlights

- Client-Server Model: Separate React frontend and Node.js backend.
- Real-time Layer: Socket.IO manages WebSocket connections for chat, call signaling, and status updates.
- WebRTC Integration: Peer-to-Peer voice communication via WebRTC, signaled through the Socket.IO server.
- Database: Supabase stores user, incident, team, and other application data.
- External Service Integrations:
    - Twilio: Handles the voice call reporting channel.
    - Transcription Service: Processes voice recordings from Twilio calls.
    - Email Service: Nodemailer configured to send transactional emails.
- Incident Processing Logic: Server-side services handle incident validation, severity calculation, team matching, and notification triggering.

## Features in Detail

### Emergency Reporting (Web & Phone)
- Web App: Registered users report incidents with type, severitydescription, and automatic location capture.
- Phone Hotline: Anonymous reporting via a Twilio number, recording and automated transcription/processing.
- Status tracking (e.g., pending, active, resolved).

### Real-time Communication
- Web Chat: Socket.IO powers instant text messaging between parties in an incident.
- Web Voice Call: WebRTC enables direct voice calls within the interface, with mute functionality.

### Location Services & Mapping
- Interactive Leaflet map displaying incident locations.
- Marker clustering prevents map clutter with large numbers incidents.
- Real-time location updates visible on the map.

### Automated Phone Reporting Workflow
1. Call received by Twilio.
2. Call recorded.
3. Recording sent to a configured external transcription API.
4. Transcription received and parsed.
5. Incident automatically created in Supabase based on information.
6. Incident processed for team assignment and notifications.

### Security Features
- Basic role distinction (Reporter, Authority).

## License

This project is licensed under the MIT License.

## Team - MAD FINGERS

- Rasesh Radadiya
- Sanghani Jaydip

## Links
- Project Demo Video: https://www.youtube.com/watch?v=Ig6gzu5QGTY