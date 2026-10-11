// Server-rendered share page for creator gifts and community invitations, served at
// https://www.play-legion.io/invite through a Hosting rewrite. It must satisfy the site's
// CSP: no scripts, no inline styles, assets and styles only from the site itself.
import {RewardType, Rarity} from '@legion/shared/enums';
import type {ChestReward} from '@legion/shared/interfaces';
import type {CommunitySummary} from '@legion/shared/communities';
import {sigilSvgMarkup} from '@legion/shared/sigilArt';
import {getEquipmentById} from '@legion/shared/Equipments';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {STEAM_DEMO_APP_ID} from './platformIdentity';
import {INVITE_COPY, type InviteLanguage, fill, gameText, steamStoreLanguage} from './inviteCopy';

export const INVITE_CSP = "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export interface InviteGift {
  token: string;
  rewards: ChestReward[];
  available: boolean;
  unlimited: boolean;
  expiresAt: number | null;
}

export interface InvitePageInput {
  gift?: InviteGift;
  community?: CommunitySummary | null;
  /** True when the link itself is malformed or points at nothing. */
  invalid?: boolean;
  /** Page language; defaults to English. */
  language?: InviteLanguage;
}

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
function storeURL(language: InviteLanguage) {
  const steamLanguage = steamStoreLanguage(language);
  return `https://store.steampowered.com/app/${STEAM_DEMO_APP_ID}/?utm_source=invite${steamLanguage ? `&l=${steamLanguage}` : ''}`;
}
const SHEETS = {
  [RewardType.EQUIPMENT]: {file: 'equipment.png', width: 320, height: 448, kind: 'Equipment'},
  [RewardType.CONSUMABLES]: {file: 'consumables.png', width: 320, height: 64, kind: 'Consumable'},
  [RewardType.SPELL]: {file: 'spells.png', width: 320, height: 128, kind: 'Spell'},
} as const;
const RARITY = ['common', 'rare', 'epic', 'legendary'];

function rewardTile(reward: ChestReward, language: InviteLanguage): string {
  if (reward.type === RewardType.GOLD) {
    return `<li class="reward rarity-gold"><span class="reward-art"><img src="/assets/gold_icon.png" alt="" width="44" height="40"></span>`
      + `<span class="reward-amount">${reward.amount.toLocaleString(language)}</span>`
      + `<span class="reward-name">${escapeHTML(gameText(language, 'Gold'))}</span><span class="reward-kind">${escapeHTML(INVITE_COPY[language].currency)}</span></li>`;
  }
  const item = reward.type === RewardType.EQUIPMENT ? getEquipmentById(reward.id)
    : reward.type === RewardType.CONSUMABLES ? getConsumableById(reward.id) : getSpellById(reward.id);
  const sheet = SHEETS[reward.type as keyof typeof SHEETS];
  if (!item || !sheet) return '';
  const x = (item.frame % 10) * 32;
  const y = Math.floor(item.frame / 10) * 32;
  const rarity = RARITY[item.rarity ?? Rarity.COMMON] ?? 'common';
  return `<li class="reward rarity-${rarity}"><span class="reward-art">`
    + `<svg class="reward-sprite" viewBox="${x} ${y} 32 32" width="56" height="56" aria-hidden="true">`
    + `<image href="/assets/${sheet.file}" width="${sheet.width}" height="${sheet.height}"/></svg></span>`
    + (reward.amount > 1 ? `<span class="reward-amount">×${reward.amount}</span>` : '')
    + `<span class="reward-name">${escapeHTML(gameText(language, item.name))}</span><span class="reward-kind">${escapeHTML(gameText(language, sheet.kind))}</span></li>`;
}

const steamLaunch = (query: string) => `steam://run/${STEAM_DEMO_APP_ID}/?${query}`;

export function renderInvitePage({gift, community, invalid, language = 'en'}: InvitePageInput): string {
  const copy = INVITE_COPY[language];
  const giftOpen = Boolean(gift?.available);
  const name = community ? escapeHTML(community.name) : '';
  const tag = community ? escapeHTML(community.tag) : '';
  const title = fill(invalid ? copy.titleInvalid
    : community && giftOpen ? copy.titleGiftFrom
    : community ? copy.titleJoin
    : giftOpen ? copy.titleGift
    : copy.titleUnavailable, {name});
  const lead = fill(invalid ? copy.leadInvalid
    : community && giftOpen ? copy.leadGiftFrom
    : community ? copy.leadJoin
    : giftOpen ? copy.leadGift
    : copy.leadUnavailable, {name});
  const launchQuery = giftOpen ? `gift=${gift!.token}` : community ? `community=${community.id}` : '';
  const store = escapeHTML(storeURL(language));
  const date = giftOpen && gift!.expiresAt
    ? new Date(gift!.expiresAt).toLocaleDateString(language === 'en' ? 'en-GB' : language, {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})
    : '';
  const fine = giftOpen
    ? [date ? fill(copy.availableUntil, {date: escapeHTML(date)}) : '', gift!.unlimited ? copy.claimUnlimited : copy.claimSingle, copy.claimOnce].filter(Boolean).join(' ')
    : '';
  const crest = community
    ? `<div class="crest">${sigilSvgMarkup(community.sigil, {size: 168, id: 'invite-sigil', label: fill(copy.sigil, {name: community.name})})}</div>`
    : `<div class="crest crest-gift"><img src="/assets/gold_chest.png" alt="" width="150" height="128"></div>`;
  const eyebrow = community ? `<p class="eyebrow"><span class="tag">${tag}</span> ${copy.eyebrowCommunity}</p>`
    : `<p class="eyebrow">${invalid || !giftOpen ? 'Emberhall' : copy.eyebrowGift}</p>`;
  const rewards = giftOpen ? `<section class="rewards" aria-labelledby="rewards-title"><h2 id="rewards-title">${copy.rewardsTitle}</h2>`
    + `<ul class="reward-grid">${gift!.rewards.map(reward => rewardTile(reward, language)).join('')}</ul>${fine ? `<p class="fine">${fine}</p>` : ''}</section>` : '';
  const stepTitle = giftOpen && community ? copy.stepClaimJoinTitle : giftOpen ? copy.stepClaimTitle : copy.stepJoinTitle;
  const stepText = fill(giftOpen && community ? copy.stepClaimJoinText : giftOpen ? copy.stepClaimText : copy.stepJoinText, {name});
  const steamIcon = '<img src="/assets/steam.png" alt="" width="24" height="24">';
  const steps = launchQuery ? `<ol class="steps">
      <li class="step"><span class="step-number">1</span><div><h2>${copy.stepDemoTitle}</h2><p>${copy.stepDemoText}</p>
        <a class="button button-secondary" href="${store}">${steamIcon}${copy.stepDemoButton}</a></div></li>
      <li class="step"><span class="step-number">2</span><div><h2>${stepTitle}</h2><p>${stepText}</p>
        <a class="button button-primary" href="${escapeHTML(steamLaunch(launchQuery))}">${copy.openButton}</a></div></li>
    </ol>` : `<p class="actions"><a class="button button-primary" href="${store}">${steamIcon}${copy.playButton}</a></p>`;
  const code = community ? `<p class="code-hint">${fill(copy.codeHint, {
    code: `<code>${escapeHTML(community.id.toUpperCase())}</code>`,
    label: escapeHTML(gameText(language, 'Join a community')),
  })}</p>` : '';
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Emberhall</title><meta name="robots" content="noindex"><link rel="icon" href="/assets/favicon.ico"><link rel="stylesheet" href="/invite.css"></head>
<body><header class="bar"><a href="/" aria-label="${copy.home}"><img src="/assets/logo.png" alt="Emberhall" class="logo" width="120" height="50"></a></header>
<main class="invite${community ? ' has-community' : ''}${giftOpen ? ' has-gift' : ''}">
<section class="hero" aria-labelledby="invite-title">${crest}<div class="hero-text">${eyebrow}<h1 id="invite-title">${title}</h1><p class="lead">${lead}</p></div></section>
${rewards}${steps}${code}
</main>
<div class="party" aria-hidden="true"><img src="/assets/warrior.png" alt="" width="220" height="220"><img src="/assets/whitemage.png" alt="" width="220" height="220"><img src="/assets/blackmage.png" alt="" width="220" height="220"></div>
<footer class="foot"><a href="/">play-legion.io</a><span>${copy.footer}</span></footer></body></html>`;
}
