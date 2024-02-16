# Repository structure

This repository contains all the different Typescript apps that are part of the project. The apps are:
- `api`: A serverless Firebase API that provides the interface between the frontend or game server and the game database (Firestore).
- `client`: A Preact frontend app that provides the user interface for the game.
- `server`: A Node.js server that provides the game server for the game.
- `shared`: Shared code between the different apps.

## API
The code is located in `api/fuctions/src` and the entry point is `index.ts`.

## Client
The code is located in `client/src` and the entry point is `index.tsx`. The main route is defined in `routes/HomePage.tsx`.

# Dev setup:
- `cd client && npm run dev` to start client in dev mode
- `cd server && npm run start` to start server in dev mode
- `cd api/functions && npm run serve` to start Firebase emulators
- `cd api/functions && npm run watch:functions` to watch API

