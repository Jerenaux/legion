# Promotional website

The old `POINT_TO_STEAM` flag and browser landing were deleted in the desktop refactor. Firebase Hosting still had the old game bundle, whose authentication and warm-up calls ran even when its CTA pointed to Steam. This standalone HTML/CSS page restores the promotional content and existing artwork without shipping or initializing game code.

- `node website/build.cjs` copies only the listed artwork/font and validates that the page cannot start the browser game. CI runs this check.
- `node website/smoke.cjs` checks desktop/mobile layout, assets, links and old game routes with a hidden browser. It blocks external traffic, including the trailer. To check the live deployment, append `https://www.play-legion.io`.
- Firebase Hosting serves `website/dist`, never `client/dist`. Its CSP disables scripts, forms and connections; only the existing YouTube trailer iframe may load remotely.
- Old game URLs fall back to the same promotional page. HTML/assets revalidate on subsequent visits.
- Change store links in `website/index.html`. Steam links use `utm_source=website`; the desktop title's Itch attribution is unchanged.
- Merge first, then deploy manually from `main`: `gh workflow run deploy-website.yml --ref main`. This deploys **Hosting only**, not Functions or desktop/store releases.

The site deliberately has no Play/login toggle: enabling browser play again requires an explicitly supported client, authentication flow and backend origin policy, not just changing a button.
