#!/bin/bash

# Steam deployment script for Legion
# Usage: ./deploy_steam.sh [production|playtest]

set -e

# Default to production if no argument provided
BUILD_TYPE=${1:-production}

# Configuration based on build type
case $BUILD_TYPE in
    "production")
        APP_ID="3729580"
        DEPOT_ID_MAC="3729581"
        DEPOT_ID_WIN="3729582"
        BUILD_DESC="Production"
        ;;
    "playtest")
        APP_ID="3870830"
        DEPOT_ID_MAC="3870831"
        DEPOT_ID_WIN="3870832"
        BUILD_DESC="Playtest"
        ;;
    *)
        echo "Error: Invalid build type '$BUILD_TYPE'"
        echo "Usage: $0 [production|playtest]"
        exit 1
        ;;
esac

echo "🚀 Starting Steam deployment for $BUILD_DESC build..."
echo "App ID: $APP_ID"
echo "macOS Depot: $DEPOT_ID_MAC"
echo "Windows Depot: $DEPOT_ID_WIN"

# Generate VDF file from template
VDF_FILE="legion_steam_build_${BUILD_TYPE}.vdf"
echo "📝 Generating VDF file: $VDF_FILE"

sed -e "s/{{APP_ID}}/$APP_ID/g" \
    -e "s/{{DEPOT_ID_MAC}}/$DEPOT_ID_MAC/g" \
    -e "s/{{DEPOT_ID_WIN}}/$DEPOT_ID_WIN/g" \
    -e "s/{{BUILD_TYPE}}/$BUILD_DESC/g" \
    legion_steam_build.vdf.template > "$VDF_FILE"

echo "✅ VDF file generated successfully"

# Steam SDK path
STEAM_SDK_PATH="/Users/jerome/Code/Steam_sdk/tools/ContentBuilder/builder_osx"

# Check if Steam SDK exists
if [ ! -d "$STEAM_SDK_PATH" ]; then
    echo "❌ Steam SDK not found at $STEAM_SDK_PATH"
    echo "Please update the STEAM_SDK_PATH variable in this script"
    exit 1
fi

# Prompt for Steam password
echo "🔐 Please enter your Steam password:"
read -s STEAM_PASSWORD

# Build and upload to Steam
echo "📤 Uploading to Steam..."
cd "$STEAM_SDK_PATH"
./steamcmd.sh +login jerorx "$STEAM_PASSWORD" +run_app_build "/Users/jerome/Code/legion/$VDF_FILE" +quit

echo "🎉 Steam deployment completed successfully for $BUILD_DESC build!"

# Clean up generated VDF file (optional)
cd "/Users/jerome/Code/legion"
rm "$VDF_FILE"
echo "🧹 Cleaned up temporary VDF file" 