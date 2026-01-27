#!/bin/bash
cd client
bun run build
cd ../
firebase deploy --only hosting
