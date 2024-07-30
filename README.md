# Repository structure

This repository contains all the different Typescript apps that are part of the project. The apps are:
- `api`: A serverless Firebase API that provides the interface between the frontend or game server and the game database (Firestore).
- `client`: A Preact frontend app that provides the user interface for the game.
- `server`: A Node.js server that provides the game server for the game.
- `matchmaker`: A Node.js server that provides the matchmaker for the game.
- `shared`: Shared code between the different apps.

## Local development

Regardless of the method you use below, the apps will be available at the following URLs:
- Client: http://localhost:8080
- Firebase emulators: http://localhost:4000 (useful to modify data in the database for testing)

### Using Docker

Run `docker-compose up --build` at the root of the repository to launch all the apps locally.

### Bare-metal

Alternatively run each service separately bare-metal:

    cd client && npm run start
    cd server && npm run start 
    cd matchmaker && npm run start
    cd api/functions && npm run emulators:start

