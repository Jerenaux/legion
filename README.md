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
Running `npm install` in `client`, `server` and `matchmaker` might still be necessary for your IDE to resolve the dependencies correctly.

### Bare-metal

Alternatively run each service separately bare-metal:
```
    cd client && npm run start
    cd server && npm run start 
    cd matchmaker && npm run start
    cd api/functions && npm run emulators:start
```

## Deployment

API deployment: `bash deploy_api.sh`
Client deployment: `bash deploy_client.sh`

Note: The API has its own `firebase.json` file used for local development with the Firebase emulators. The `firebase.json` at the root of the repository is the one used for deployment to prod.

### Setting up secrets

For Firebase Functions:  `firebase functions:secrets:set SECRET_NAME`, you'll then be prompted to enter the secret value. It can then be accessed in the code with `process.env.SECRET_NAME`. 

To access it in Firebase Functions, don't forget to add `{ secrets: ["<secret_name>"] }` to the function declaration.

To access it in one of the Cloud Run services, go to the Google Cloud Console, select the project, then click on the service and edit to create a new revision. In the secrets tab you can add a secret referring to the one set in Firebase.

# Electron

To build the Electron app, run `npm run electron:build`. This will create a `release` folder with the app.

To run the Electron app, run `npm run electron:dev`. This will start the app in development mode.

To test the Electron app, run `npm run electron:test`. This will create a `release` folder with the app and run it.

## Steam

The Steam build is done by running `npm run electron:build:<platform>`.

Test with `open release/mac-arm64/Legion.app` or `release/mac-arm64/Legion.app/Contents/MacOS/Legion` in a terminal.

### Steampipe

Have a vdf file created for the platform you want to build for.

Then `cd /Users/jerome/Code/Steam_sdk/tools/ContentBuilder/builder_osx`
and run `bash ./steamcmd.sh +login jerorx <password> +run_app_build /Users/jerome/Code/legion/legion_mac_build.vdf +quit`