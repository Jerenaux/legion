# Localized artwork provenance

Portuguese artwork and text-free flag templates were edited from the existing Legion raster assets with the imagegen tool. The originals remain unchanged. Generated PNGs were inspected for spelling, appearance and transparency, then resized with macOS `sips` to a maximum edge of 288px for flags and 512px for titles/announcements.

The edit instruction for each Portuguese asset was: preserve the original game-art style, composition, border, icon, colors and transparent background; replace only the English wording with the exact Portuguese wording below, legible at game UI size. Active and idle flags were generated separately. Full-phrase announcement artwork replaces split English word sprites so translated word order is unconstrained.

| Asset | Text |
|---|---|
| Play flags | JOGAR |
| Team flags, pt-BR | EQUIPE |
| Team flags, pt-PT | EQUIPA |
| Shop flags | LOJA |
| Rank flags | LIGA |
| Victory | VITÓRIA! |
| Defeat | DERROTA |
| Combat begins | COMEÇA O COMBATE! |
| Multi-kill | ELIMINAÇÃO MÚLTIPLA! |
| Multi-hit | ACERTO MÚLTIPLO! |
| One shot | GOLPE ÚNICO! |
| Frozen | CONGELADO! |
| Burning | EM CHAMAS! |
| Tutorial | TUTORIAL! |

For the eight templates in `client/public/localization`, the edit instruction was: remove only the English word; preserve the icon, flag frame, lighting, material and alpha transparency. The renderer supplies the selected language’s label as text. These templates do not contain translated lettering and can be reused by every language.

Generated source files were kept in the imagegen output directory; the final optimized assets are tracked under `client/locales/pt-BR/assets`, `client/locales/pt-PT/assets`, and `client/public/localization`. Guide illustrations are captures of the game, not generated art.
