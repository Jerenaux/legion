#!/bin/bash

export DEPLOY=true # For webpack to know where to find the shared code

# Check if an argument is provided
if [ $# -eq 0 ]; then
    # No argument provided, deploy all functions
    firebase deploy --only functions
else
    # Convert comma-separated function names into proper firebase deploy syntax
    FUNCTIONS=$(echo $1 | sed 's/,/,functions:/g')
    FUNCTIONS="functions:$FUNCTIONS"
    
    # Deploy the specified functions
    firebase deploy --only $FUNCTIONS
fi
