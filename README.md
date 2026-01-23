# Legion

A real-time multiplayer game built with a modern microservices architecture, featuring automated CI/CD, comprehensive testing, and scalable cloud infrastructure.

## Architecture Overview

This project implements a distributed system with five core services working together to deliver a seamless multiplayer gaming experience:

```text
┌─────────────┐      ┌──────────────┐       ┌─────────────┐
│   Client    │─────▶│  Matchmaker  │─────▶│   Server    │
│  (Preact)   │      │  (Cloud Run) │       │ (WebSocket) │
└──────┬──────┘      └──────┬───────┘       └──────┬──────┘
       │                    │                      │
       │                    ▼                      │
       │             ┌─────────────┐               │
       └────────────▶│   Firebase  │◀─────────────┘
                     │  Functions  │
                     └─────────────┘
```

### Services

- **`client/`** - Preact-based web application with Phaser game engine
  - Progressive web app with offline support
  - Real-time game rendering and user interface
  - Electron wrapper for desktop distribution (Steam)
- **`server/`** - Node.js game server with WebSocket communication
  - Authoritative game state management
  - Real-time multiplayer synchronization via Socket.io
  - Game logic validation and anti-cheat measures

- **`api/`** - Firebase Cloud Functions (serverless)
  - RESTful API for game data operations
  - Authentication and authorization
  - Integration with Firestore database

- **`matchmaker/`** - Cloud Run service for player matchmaking
  - Queue management and skill-based matching
  - Lobby creation and player coordination
  - Auto-scaling based on player demand

- **`shared/`** - Shared TypeScript types and utilities
  - Type-safe communication between services
  - Reusable game logic and constants
  - Single source of truth for data models

- **`dashboardv2/`** - Analytics dashboard (Python/Dash)
  - Real-time game metrics and monitoring
  - Player statistics and insights

## Tech Stack

### Frontend

- **Preact** - Lightweight React alternative (3KB)
- **Phaser 3** - HTML5 game engine
- **TypeScript** - Type-safe development
- **Webpack** - Module bundling and optimization
- **Electron** - Desktop application wrapper

### Backend

- **Node.js** - Runtime environment
- **Socket.io** - Real-time bidirectional communication
- **Express** - HTTP server framework
- **Firebase Admin SDK** - Backend Firebase integration

### Infrastructure

- **Firebase Hosting** - Static site hosting with global CDN
- **Firebase Functions** - Serverless API deployment
- **Google Cloud Run** - Containerized service deployment
- **Firestore** - NoSQL document database
- **Docker** - Containerization and local development

### DevOps

- **GitHub Actions** - CI/CD automation
- **Jest** - Testing framework with coverage reporting
- **ESLint** - Code quality and consistency
- **Sentry** - Error tracking and monitoring

## CI/CD Pipeline

The project features a comprehensive automated deployment pipeline:

### Continuous Integration

- **Automated Testing** - All pushes trigger test suites
  - Server tests with Jest and coverage reporting
  - Client build verification
  - API linting and compilation checks
  - Matchmaker build validation

- **Parallel Execution** - All services tested concurrently
- **Coverage Reporting** - Codecov integration for visibility

### Continuous Deployment

- **Path-based Deployment** - Smart detection of changed services
  - Only deploys affected components
  - Reduces deployment time and costs
  - Minimizes production risk

- **Preview Environments** - Automatic staging for pull requests
  - Temporary Firebase Hosting URLs
  - 7-day expiration for cost control
  - Automated comment with preview link

- **Production Deployment** - Automated on merge to `main`
  - Client → Firebase Hosting
  - API → Firebase Functions
  - Matchmaker → Google Cloud Run
  - Server → Google Cloud Run

- **Manual Triggers** - All workflows support manual execution via GitHub Actions UI

### Workflow Files

- `.github/workflows/ci.yml` - Test and build validation
- `.github/workflows/deploy-preview.yml` - PR preview environments
- `.github/workflows/deploy-client.yml` - Client production deployment
- `.github/workflows/deploy-matchmaker.yml` - Matchmaker deployment

## Development

### Prerequisites

- Bun 1.3+
- Node.js 20+
- Docker & Docker Compose (for containerized development)
- Firebase CLI (for emulator and deployment)

### Local Development with Docker (Recommended)

The easiest way to run the entire stack locally:

```bash
docker-compose up --build
```

This starts all services with hot-reloading enabled:

- **Client**: <http://localhost:8080>
- **Firebase Emulators UI**: <http://localhost:4000>
- **Game Server**: <http://localhost:3123>
- **Matchmaker**: <http://localhost:3000>
- **Dashboard**: <http://localhost:8050>

**Note:** You may need to run `bun install` in `client`, `server`, and `matchmaker` directories for IDE IntelliSense to work properly.

### Bare-Metal Development

Run each service independently:

```bash
# Terminal 1 - API & Firebase Emulators
cd api/functions && bun run emulators:start

# Terminal 2 - Client
cd client && bun run start

# Terminal 3 - Game Server
cd server && bun run start

# Terminal 4 - Matchmaker
cd matchmaker && bun run start
```

### Running Tests

```bash
# Server tests with coverage
cd server && bun run test

# Watch mode for development
cd server && bun run test:watch

# Coverage report
cd server && bun run test:coverage
```

## Deployment

### Automated Deployment (Primary Method)

1. **Develop** - Create a feature branch and make changes
2. **Test** - Open a PR to trigger automated tests and preview deployment
3. **Review** - Use the preview URL to verify changes
4. **Merge** - Merge to `main` to automatically deploy to production

The CI/CD pipeline handles everything automatically, including:

- Running test suites
- Building optimized bundles
- Deploying only changed services
- Updating live environments

### Manual Deployment (Legacy)

For situations where manual deployment is needed:

```bash
# Located in tools/legacy_deployment/
bash tools/legacy_deployment/deploy_client.sh
bash tools/legacy_deployment/deploy_api.sh
bash tools/legacy_deployment/deploy_server.sh
bash tools/legacy_deployment/deploy_matchmaker.sh
```

**Note:** The root `firebase.json` is used for production deployment. The `api/functions/firebase.json` is for local emulator development.

## Configuration

### Environment Variables

Each service uses environment variables for configuration:

**Client** (`.env` or Docker environment):

```bash
API_URL=http://localhost:5001/legion-32c6d/us-central1
GAME_SERVER_URL=http://localhost:3123
MATCHMAKER_URL=http://localhost:3000
USE_FIREBASE_EMULATOR=true
```

**Server** (Docker or `.env`):

```bash
API_URL=http://api:5001/legion-32c6d/us-central1
CLIENT_ORIGIN=*
NODE_ENV=development
```

### Managing Secrets

**Firebase Functions:**

```bash
firebase functions:secrets:set SECRET_NAME
```

Access in code:

```typescript
process.env.SECRET_NAME; // Add { secrets: ["SECRET_NAME"] } to function declaration
```

**Cloud Run Services:**

1. Set secret in Firebase Functions first
2. Navigate to Google Cloud Console → Cloud Run
3. Edit service → Create new revision → Add secret reference

## Desktop Distribution

The client can be packaged as an Electron desktop application for cross-platform distribution.

### Building Desktop Apps

```bash
cd client

# Development mode
bun run electron:dev

# Production builds
bun run electron:build          # macOS + Windows
bun run electron:build:mac      # macOS only
bun run electron:build:win      # Windows only
bun run electron:build:linux    # Linux only
```

### Steam Deployment

For Steam-specific deployment instructions, see [STEAM_DEPLOYMENT.md](./STEAM_DEPLOYMENT.md).

## Project Structure

```text
legion/
├── .github/
│   └── workflows/              # CI/CD pipeline definitions
├── api/
│   └── functions/              # Firebase Cloud Functions
│       └── src/                # API endpoints
├── client/
│   ├── src/                    # Preact components and game code
│   ├── public/                 # Static assets
│   └── electron.js             # Electron main process
├── server/
│   └── src/                    # Game server logic
├── matchmaker/
│   └── src/                    # Matchmaking service
├── shared/                     # Shared TypeScript definitions
├── dashboardv2/                # Analytics dashboard
├── tools/
│   └── legacy_deployment/      # Manual deployment scripts
├── docker-compose.yml          # Local development orchestration
└── firebase.json               # Firebase configuration
```

## Code Quality Practices

- **TypeScript Everywhere** - Type safety across all services
- **Shared Types** - Common definitions prevent API contract drift
- **Automated Testing** - Server tests with >XX% coverage
- **Linting** - ESLint enforces code consistency
- **Code Reviews** - All changes reviewed via pull requests
- **Preview Environments** - Test changes before production
- **Error Tracking** - Sentry integration for production monitoring
- **Performance Monitoring** - Real-time metrics and alerts

## Contributing

1. Create a feature branch from `main`
2. Make your changes with descriptive commits
3. Open a pull request
4. Automated tests will run and create a preview environment
5. Address review feedback
6. Merge to `main` for automatic deployment

## License

**Proprietary - Source Available for Review Only**

Copyright © 2026 Jerome Renaux

This repository is made available for:

- Portfolio review
- Educational reference
- Demonstration purposes

The source code is **not licensed** for use, modification, or distribution. All rights reserved.

If you wish to use any part of this code, please contact me directly.
