# Game localization

The game discovers languages from `client/locales/<BCP-47-code>/`. Adding a language requires translation files and, optionally, artwork and a font. No language list, application code, server changes or save migration is needed. Rebuild the game to include the files.

## Add a language

1. Copy `client/locales/en` to a folder named with a canonical language tag, such as `it` or `pt-PT`.
2. In `locale.json`, set `name` to the language’s own name and `direction` to `ltr` or `rtl`. The folder supplies the language code. Replace or remove the copied `steamLanguages` array: it lists this locale’s [Steam API language codes](https://partner.steamgames.com/doc/store/localization/languages), such as `["italian"]`; aliases must be unique across locales. Optional `fontFamily` names a bundled font; optional `assetLanguage` names one other locale whose artwork is shared.
3. Translate the **values** in `messages.json`. Keep the English keys unchanged: they identify messages and provide translator context. Do not translate `{{placeholders}}`, numbered component tags or HTML attributes. Translate whole sentences; reorder placeholders and tagged phrases as needed. Names supplied by players remain their names.
4. Supply every plural category used by the language. Keys ending in `_one` and `_other` share a base; languages may need `_zero`, `_two`, `_few` or `_many` too. `bun run locales:check` reports the required forms. Pass numeric values unchanged; the game applies locale-aware number formatting.
5. If the script needs another font, put licensed `.woff2` files in `fonts/`, include their license, and set `fontFamily`. Fonts load locally before the combat canvas starts. Prefer full fonts so later text additions do not require regenerating a subset.
6. From `client`, run `bun run locales:check` and `bun run test:localization --locale=<code>`. Inspect the screenshots printed by the test at desktop and compact sizes and with 130% text. Review long words, accents, glyph coverage, controls, tooltips, dialogue and the combat HUD.
7. Refresh translated guide screenshots with `bun run guide:screenshots --locale=<code>`. These are captured from the actual translated interface and saved to that locale’s `assets/guide/` folder. See [player-guide.md](player-guide.md) for the fixture and crop workflow.

For existing languages, edit only the relevant values or asset files, then run the same checks. Translation changes do not change shared gameplay data, protocol identifiers or saved character names. The title screen and Settings expose the automatically discovered language list; changing it updates the current screen immediately, including artwork, fonts, numbers and native dialogs. The selection is saved without reloading or resetting open dialogs. Language changes are disabled during matches, replays, queues and lobbies.

## Artwork

Place an override under `assets/`, using the original filename/path. Supported formats are PNG, JPEG, WebP and SVG. Preserve alpha transparency. The following text-bearing artwork has localization hooks:

- `play_btn_idle.png`, `play_btn_active.png`, `team_btn_idle.png`, `team_btn_active.png`, `shop_btn_idle.png`, `shop_btn_active.png`, `rank_btn_idle.png`, `rank-btn-active.png`.
- `game_end/victory.png`, `game_end/defeat.png`.
- `announcements/combat-begins.png`, `multi-kill.png`, `multi-hit.png`, `one-shot.png`, `frozen.png`, `burning.png`, `tutorial.png` (all inside `announcements/`). Each announcement is one complete phrase, permitting any word order.
- `guide/battle.jpg`, `guide/actions.jpg`, `guide/turn-order.jpg`, `guide/inspection.jpg`, `guide/loadout.jpg`, `guide/tower.jpg`.

Portuguese includes repainted flags, victory/defeat titles and announcements. European Portuguese overrides the team flags and inherits the other Portuguese artwork through `assetLanguage`. Original English artwork remains available.

Other languages can use translated text on the text-free flag backgrounds and rendered whole-phrase combat/result titles. These labels come from the same message catalog and use the locale font. This avoids baking another alphabet into every image. Any locale may replace them with custom artwork using the paths above. The Legion logo, item illustrations, portraits and grade symbols are shared.

Artwork resolves from the selected locale, then its optional `assetLanguage`, the base language, and English. Text-bearing flags/titles fall back to translated live text when no override exists; illustrated guide screenshots use English until regenerated.

## Selection and fallback

A saved player choice takes priority over Steam’s game language, then OS/browser language preferences. Steam uses [`ISteamApps::GetCurrentGameLanguage`](https://partner.steamgames.com/doc/api/ISteamApps#GetCurrentGameLanguage), which respects the title-specific choice in Steam and otherwise uses the Steam UI language. The native SDK initializes before the first window and supplies the language synchronously through preload; authentication still requests its ticket later and reuses the same SDK client. `steamLanguages` in each locale’s metadata maps Steam aliases, including `portuguese` to European Portuguese, `brazilian` to Brazilian Portuguese, and `schinese`/`tchinese` to the two Chinese scripts. Unknown Steam languages and unavailable Steam fall through to OS/browser preferences. Direct downloads and Itch launches do not initialize Steam for language selection.

Region-specific matches win; otherwise matching language and script are used. `zh-TW` and `zh-HK` select Traditional Chinese; `zh-CN` and `zh-SG` select Simplified Chinese. Bare Portuguese selects Brazilian Portuguese. Unknown preferences fall back to English. Missing messages fall back to English at runtime, while the catalog check rejects incomplete shipped catalogs.

Native crash recovery and the independent startup screen use the same catalogs and language matcher. The renderer sends the selected language to the native process through validated IPC. Before the renderer starts, native recovery uses Steam’s language or the OS language. The independent startup script then synchronizes the saved player override even if the main game bundle fails.

Steam language selection requires a launch with a valid Steam App ID and the Steam client available. Steamworks language support settings for Legion Demo must also reflect the shipped translations; the repository does not publish Steamworks settings. To verify end to end, launch the Demo from Steam with no saved in-game choice, change its Steam language, restart, and check both the startup and title screens. Repeat with an explicit in-game choice to verify that it persists.

Rich messages use fixed application components through `Trans`; interpolation is escaped before markup parsing. Legacy popup markup permits only the existing highlighted spans, checked by the catalog validator. Never add executable markup, URLs or application logic to translations.

## Validation and source changes

`locales:check` checks automatic discovery, unique Steam language aliases, key coverage, language-specific plural forms, interpolation, balanced/allowed markup and literal translation keys in source. CI runs it alongside client tests and TypeScript. Developers adding a new player-facing message must add its English key and translate it in every shipped language in the same change. Dynamic item/spell, enum and server-message keys require the same care; the shared game data stays language-independent.

The packaged localization smoke test uses local fixtures and local telemetry ingestion. It checks the title screen, team, shop, rank, Tower, profile, guide, combat and settings at 1280 × 720 and 960 × 540 with standard text, and at 1280 × 720 with 130% text. It also checks recruitment previews, Tower routes and upgrades, result titles, combat announcements, artwork loading, script fonts, live language changes without reloading, locale persistence, the disabled in-match language picker and rich-text interpolation. Horizontal overflow assertions cover key controls; manually inspect the screenshots for vertical clipping, overlaps and legibility. Screenshot fixtures and test instrumentation are never release assets; only the cropped guide images are bundled.

The supplied CJK fonts are Noto Sans JP/SC/TC/KR from the [Google Fonts repository](https://github.com/google/fonts), distributed with their SIL Open Font License. Full font files are compressed to WOFF2 without subsetting.

Russian (`ru`, **Русский**) includes the full Noto Sans variable font from
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosans), compressed
to WOFF2 without subsetting, with its SIL Open Font License. Its catalog includes
all four Russian plural categories (`one`, `few`, `many`, `other`). Flags and
combat/result titles use the translated live labels; the six guide screenshots
are captured from the Russian interface. Steam's `russian` alias and regional
OS preferences such as `ru-RU` select it automatically unless the player has
saved another choice.
