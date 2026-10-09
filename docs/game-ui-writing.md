# Game UI and writing

These rules apply to all player-facing Emberhall copy, including tutorials, menus,
rewards, dialogs and the guide. They record Jerome's October 2026 review of the
guided-practice introduction. Read them before writing or redesigning a screen.

## What went wrong

The introduction stacked a welcome, a large heading, a slogan, reassurance, two
start choices and another reassurance line around three character cards. Almost
every supporting sentence sounded like a small advertisement. It repeated what
the artwork showed and promised an easy experience without explaining anything
specific about the battle.

| Rejected example | Problem |
| --- | --- |
| “Three champions. One team. Lead them to victory.” | A dramatic three-beat slogan with little information. The champions are already visible; victory is a generic goal. |
| “Time to learn, room to experiment” | Balanced reassurance without a concrete reason that mistakes are safe. Could be pasted into unrelated products. |
| “A little guidance as you go” | Describes the designer's onboarding intent. Does not tell the player what help they receive. |
| “Welcome to the arena” + “Meet your champions” + a subtitle | Three layers of introduction where one label would work. A landing-page structure imposed on a game. |
| “One action per turn” followed by reassurance | The real rule deserved clarity: movement itself consumes the action. The appended reassurance diluted it. |

“Close combat,” “Healing,” and “Ranged magic” worked because they explained the
characters' roles. “Play without tips” worked because it described a real choice.
Short sentences, parallel structure and enthusiastic language are not inherently
bad or proof of AI authorship. Repetition, weak information and poor fit for the
moment caused the problem here.

## Write for the player's next decision

- Each line must identify something, explain a consequential rule, tell the
  player what to do, or report a state they need to know. Delete lines that do none.
- Use one introduction at most. Do not fill an eyebrow, headline and subtitle
  just because a layout has room for them.
- Avoid motivational filler, trailer slogans and symmetrical reassurance.
  Do not attach a comforting sentence to every factual one.
- State concrete protections only when the game implements them. Never imply
  unlimited time, consequence-free mistakes, or automatic help without evidence.
- Prefer game verbs and objects: move, cast, ally, tile, mana. Avoid describing
  the intended experience with words such as seamless, intuitive or empowering.
- Name the action on its button. Use a toggle for a preference instead of two
  competing start buttons. Keep necessary warnings next to the affected choice.
- Teach one immediate action at a time. Highlight the real control and use its
  existing icon. Avoid repeating a title in the explanatory sentence.
- Keep the opening briefing brief: turns and the action limit, controls, then
  tile-based Fire and terrain, illustrated with real cropped game screenshots.
  Situational combat tips may explain an unfamiliar status or hazard when it
  actually occurs and has not been seen before. Do not turn those tips into a
  forced lesson sequence. Keep spell costs in the action bar and spell details.
- Match guidance to the live battle. Do not mention highlighted targets before
  targeting is enabled, or suggest casting when nothing is in range. Check the
  authoritative server layout too: a local client build still uses production
  formation rules until the server changes are deployed.
- Let success be visible in the game. Do not narrate every completed action or
  repeatedly announce that the player is learning.
- Keep flavor where it adds a specific voice or a memorable game moment. Do not
  replace generic marketing prose with equally generic fantasy roleplay.
- Translate intent naturally. Do not preserve an English slogan's rhythm at the
  expense of clear writing in another language.

## Design a game screen

Characters, class crests, loot, terrain and combat controls carry the identity.
Use them as the main event. Keep the battle or party visible; reserve panels for
information that actually needs a backing surface. A welcome screen does not
need website hero copy, a feature-card grid, or a footer tagline.

Use motion and sound as feedback for entering battle, revealing a team or
receiving loot. Respect sound settings and reduced motion. Do not force extra
clicks or wait for decorative animations before allowing the player to continue.
Never hide meaning behind unlabeled icons: pair unfamiliar controls with short
labels, tooltips or accessible names. Keep keyboard/controller navigation and
focus visible. Check 1280×720 and compact layouts, enlarged text and long/CJK
translations. Contextual combat tips must not obscure their target or block input. The opening
briefing is deliberately modal: keep combat stopped until it is completed or
skipped, and contain keyboard/controller input inside it.

## Review before shipping

Read the actual screen, not just the string file. Check whether a line can be
removed without losing information. Check whether it could be pasted unchanged
into an unrelated game or app. Read the remaining copy aloud. If several lines
share the same punchy or reassuring rhythm, rewrite the passage as a whole.
Verify every mechanical claim against the implementation. Do not add typos,
slang or random quirks merely to make writing seem human.

## Research behind the review

- [Reinhart et al., Do LLMs write like humans?](https://arxiv.org/html/2410.16107v2):
  models show systematic stylistic preferences and difficulty matching human
  variation across genres. This supports checking genre fit and repeated patterns;
  it does not establish that any particular slogan proves AI authorship.
- [Doshi and Hauser, Science Advances](https://www.science.org/doi/10.1126/sciadv.adn5290):
  AI-assisted short stories could score better individually while becoming more
  similar to one another. Applying that finding to game UI is an editorial analogy.
- [Microsoft writing guidance](https://learn.microsoft.com/en-us/windows/apps/design/style/writing-style):
  prioritize the needed information and avoid padded introductions.
- [NN/g tone research](https://www.nngroup.com/articles/tone-voice-users/):
  tone depends on audience and situation; forced personality can obstruct meaning.

The last two sources concern interfaces and websites. Use their findings about
clarity and audience, not their page layouts or brand conventions, as a template
for Emberhall. The rejected examples and the rules above are our editorial judgment.
