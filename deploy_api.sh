#!/bin/bash

export DEPLOY=true # For webpack to know where to find the shared code

# Check if an argument is provided
if [ $# -eq 0 ]; then
    # No argument provided, deploy all functions
    firebase deploy --only functions
else
    # Argument provided, deploy only the specified function
    firebase deploy --only functions:$1
fi