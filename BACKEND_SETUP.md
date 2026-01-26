# 🎸 GigMatch Backend Setup Guide

This guide helps you set up the GigMatch NestJS backend and connect it to the Roxxie Flutter frontend.

## 🚀 Prerequisites

- **Node.js** (v18 or higher)
- **Docker** & **Docker Compose** (Recommended for Database)
- **MongoDB** (If running locally without Docker)

## 🛠️ Quick Start (Recommended)

The easiest way to run the backend is using Docker Compose, which spins up both the API and MongoDB.

1. **Clone the repository** (if you haven't already).
2. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Update .env with your configuration if needed (e.g. Stripe keys)
   ```
3. **Start the Stack**:
   ```bash
   docker-compose up --build
   ```

The API will be available at: `http://localhost:3000/api/v1`
API Documentation (Swagger): `http://localhost:3000/api/docs`

## 💻 Manual Setup (Development)

If you prefer to run Node.js locally:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start MongoDB**:
   Ensure you have a local MongoDB instance running at `mongodb://localhost:27017` or update `MONGODB_URI` in `.env`.
3. **Start the Server**:
   ```bash
   npm run start:dev
   ```

## 📱 Connecting Flutter Frontend (Roxxie)

To connect the Flutter app to this backend, you need to configure the API base URL in the Flutter project.

### 1. Network Configuration

- **Android Emulator**: Use `http://10.0.2.2:3000/api/v1`
- **iOS Simulator**: Use `http://localhost:3000/api/v1`
- **Physical Device**: You need to use your computer's local IP address (e.g., `http://192.168.1.5:3000/api/v1`). Ensure your firewall allows incoming connections on port 3000.

### 2. Verify Connection

Before running the app, verify the backend is reachable:
- Open `http://localhost:3000/api/docs` in your browser.
- You should see the Swagger API documentation.

### 3. Troubleshooting

- **CORS Errors**: The backend is configured to allow requests from `localhost`. If you are running the app on a different domain or port, add it to `CORS_ORIGINS` in your `.env` file.
  ```env
  CORS_ORIGINS=http://localhost:3000,http://your-custom-domain.com
  ```
- **Database Connection**: If the API fails to start, check if MongoDB is running.
- **Port Conflicts**: If port 3000 is in use, change `PORT` in `.env` and update the `docker-compose.yml` mapping.

## ✅ Verification

You can run the included verification script to ensure your environment is set up correctly:

```bash
npx ts-node scripts/verify-setup.ts
```
