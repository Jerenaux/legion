# Steam Deployment Guide

This document contains all Steam-specific deployment information for the Legion desktop application.

## Overview

Legion is distributed on Steam using Electron builds packaged via `electron-builder`. The deployment process uses `steamcmd` to upload builds to Steam's content delivery network.

## Steam Configuration

**Partner ID:** 325618

### Production App
- **App ID:** 3729580
- **macOS Depot:** 3729581
- **Windows Depot:** 3729582

### Playtest App
- **App ID:** 3870830
- **macOS Depot:** 3870831
- **Windows Depot:** 3870832

## Building for Steam

Before deploying to Steam, you must build the Electron application:

```bash
cd client

# Build for specific platform
npm run electron:build:mac      # macOS build
npm run electron:build:win      # Windows build

# Build both platforms
npm run electron:build
```

Builds are output to `client/release/`.

### Testing Builds Locally

**macOS:**
```bash
# GUI
open release/mac-arm64/Legion.app

# Terminal (for logs)
release/mac-arm64/Legion.app/Contents/MacOS/Legion
```

**Windows:**
```bash
# Run the executable from release/win-unpacked/
```

## Deployment Commands

The project includes an automated deployment script that handles VDF generation and upload:

### Deploy to Production
```bash
./tools/legacy_deployment/deploy_steam.sh production
```

### Deploy to Playtest
```bash
./tools/legacy_deployment/deploy_steam.sh playtest
```

### What the Script Does
1. Generates the appropriate VDF (Valve Data File) configuration from `legion_steam_build.vdf.template`
2. Uploads the build to Steam using `steamcmd`
3. Cleans up temporary files

## VDF Configuration

The deployment uses `legion_steam_build.vdf.template` as a template. The script automatically substitutes:
- App ID
- Depot IDs
- Build description
- Content paths

**Template location:** `legion_steam_build.vdf.template`

## Manual Setup (One-Time Configuration)

These steps should already be configured, but are documented for reference:

### For Both Apps

1. **Create Depots** - Set up platform-specific depots in Steam Partner portal
2. **Configure Store Package** - Add all depots to the store package
3. **Set Launch Options** - Define how Steam should launch the game
4. **Verify Packages** - Ensure packages include correct depots

### Production App Links
- [Depots Configuration](https://partner.steamgames.com/apps/depots/3729580)
- [Build History](https://partner.steamgames.com/apps/builds/3729580)
- [Store Package](https://partner.steamgames.com/store/packagelanding/1312865)
- [Launch Options](https://partner.steamgames.com/apps/config/3729580)
- [Package Management](https://partner.steamgames.com/pub/packageadmin/325618)

### Playtest App Links
- [Depots Configuration](https://partner.steamgames.com/apps/depots/3870830)
- [Build History](https://partner.steamgames.com/apps/builds/3870830)
- [Store Package](https://partner.steamgames.com/store/packagelanding/1312865)
- [Launch Options](https://partner.steamgames.com/apps/config/3870830)
- [Package Management](https://partner.steamgames.com/pub/packageadmin/325618)
- [Playtest Management](https://partner.steamgames.com/apps/playtest/3870830)

## Deployment Workflow

Recommended workflow for releasing updates:

1. **Build** - Create the Electron app locally
   ```bash
   cd client && npm run electron:build
   ```

2. **Deploy to Playtest** - Test with a limited audience
   ```bash
   bash tools/legacy_deployment/deploy_steam.sh playtest
   ```

3. **Set as Default** - In the [Builds page](https://partner.steamgames.com/apps/builds/3870830), set the new build as default for the playtest branch
   - **No need to click "Publish"** for playtest

4. **Test** - Verify the build works correctly via Steam playtest

5. **Deploy to Production** - Release to all users
   ```bash
   bash tools/legacy_deployment/deploy_steam.sh production
   ```

6. **Set Live** - Set the production build as default on the "default" branch

## Configuration Checklist

When setting up a new Steam app, ensure:

- [ ] At least one depot is set to **[All Languages]**
- [ ] Build has been uploaded to that depot
- [ ] Depot is added to **Developer Comp** package
- [ ] Depot is added to **Free** package
- [ ] Depot is added to all production packages (including red packages)
- [ ] Build is set live on the **"default"** branch
- [ ] Launch options are correctly configured
- [ ] Supported operating systems are checked in Steamworks admin

## Troubleshooting

### Download Size Shows 0 MB
This usually indicates the build wasn't uploaded to the depot correctly.

**Solutions:**
- Verify depot configuration in Partner portal
- Check that the VDF file references the correct depot IDs
- Try manual upload via [Depot Uploads page](https://partner.steamgames.com/apps/depotuploads/3870830)

### "Platform Support Matches" Error
The app isn't configured for the correct operating systems.

**Solution:**
1. Go to [Steamworks Admin](https://partner.steamgames.com/apps/view/3729580) (use correct app ID)
2. Navigate to "Supported Operating Systems"
3. Check the appropriate boxes (Windows, macOS, Linux)

### Build Not Appearing for Users
Ensure the build is set as the default for the correct branch:
- **Playtest:** Set on playtest branch (no publish needed)
- **Production:** Set on "default" branch

### Authentication Issues
If `steamcmd` authentication fails:
- Verify your Steam account has access to the partner account
- Check that you've accepted any pending agreements in Steam Partner portal
- Try logging in to `steamcmd` manually first

## Advanced Configuration

### Custom Launch Options
Configure how Steam launches the game:
- Set executable path
- Add launch parameters
- Configure working directory
- Set environment variables

### Branch Management
Steam supports multiple branches for different release channels:
- **default** - Public release branch
- **playtest** - Playtest branch for limited testing
- **beta** - Optional beta testing branch
- Custom branches can be created for specific purposes

### Content Builder
For more complex builds, you can use Steam's Content Builder directly:
- Located in `steamcmd/builder/`
- Provides more granular control over depot configuration
- Useful for large games with complex file structures

## Reference

**Official Documentation:**
- [Steamworks Documentation](https://partner.steamgames.com/doc/home)
- [SteamCMD Documentation](https://partner.steamgames.com/doc/sdk/uploading/steamcmd)
- [Depot Management](https://partner.steamgames.com/doc/store/application/depots)

**Template File:**
- `legion_steam_build.vdf.template` - VDF configuration template

**Deployment Script:**
- `tools/legacy_deployment/deploy_steam.sh` - Automated deployment script
