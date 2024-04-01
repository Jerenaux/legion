# Repository structure

This repository contains all the different Typescript apps that are part of the project. The apps are:
- `api`: A serverless Firebase API that provides the interface between the frontend or game server and the game database (Firestore).
- `client`: A Preact frontend app that provides the user interface for the game.
- `server`: A Node.js server that provides the game server for the game.
- `shared`: Shared code between the different apps.

## API
The code is located in `api/fuctions/src` and the entry point is `index.ts`.

To run it locally:
- Install `firebase tools`: `npm install -g firebase-tools`
- Then create an `.env` file in the `client` folder with the following env variables:
```
API_URL=http://127.0.0.1:5001/legion-32c6d/us-central1
USE_FIREBASE_EMULATOR=true
```
- Run `cd api/functions && npm run serve`
- Restart the client if need be

To have data to use in the UI, use the Log In button and create an account, which will create a user in the Firestore database.

To modify the data in the database, navigate in your browser to `127.0.0.1:4000/firestore/` and modify the objects as desired.


## Client
The code is located in `client/src` and the entry point is `index.tsx`. The main route is defined in `routes/HomePage.tsx`.

To serve the client, run `npm run dev` in the `client` directory.

# Dev setup:
- `cd client && npm run dev` to start client in dev mode
- `cd server && npm run start` to start server in dev mode
- `cd api/functions && npm run serve` to start Firebase emulators
- `cd api/functions && npm run watch:functions` to watch API

