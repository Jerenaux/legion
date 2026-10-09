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
}

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const STORE_URL = `https://store.steampowered.com/app/${STEAM_DEMO_APP_ID}/?utm_source=invite`;
const SHEETS = {
  [RewardType.EQUIPMENT]: {file: 'equipment.png', width: 320, height: 448, kind: 'Equipment'},
  [RewardType.CONSUMABLES]: {file: 'consumables.png', width: 320, height: 64, kind: 'Consumable'},
  [RewardType.SPELL]: {file: 'spells.png', width: 320, height: 128, kind: 'Spell'},
} as const;
const RARITY = ['common', 'rare', 'epic', 'legendary'];

function rewardTile(reward: ChestReward): string {
  if (reward.type === RewardType.GOLD) {
    return `<li class="reward rarity-gold"><span class="reward-art"><img src="/assets/gold_icon.png" alt="" width="44" height="40"></span>`
      + `<span class="reward-amount">${reward.amount.toLocaleString('en-US')}</span>`
      + `<span class="reward-name">Gold</span><span class="reward-kind">Currency</span></li>`;
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
    + `<span class="reward-name">${escapeHTML(item.name)}</span><span class="reward-kind">${sheet.kind}</span></li>`;
}

const steamLaunch = (query: string) => `steam://run/${STEAM_DEMO_APP_ID}/?${query}`;

export function renderInvitePage({gift, community, invalid}: InvitePageInput): string {
  const giftOpen = Boolean(gift?.available);
  const name = community ? escapeHTML(community.name) : '';
  const tag = community ? escapeHTML(community.tag) : '';
  const title = invalid ? 'This link doesn’t work'
    : community && giftOpen ? `${name} sent you a gift`
    : community ? `Join ${name} in Emberhall`
    : giftOpen ? 'A gift is waiting for you'
    : 'This gift is no longer available';
  const lead = invalid ? 'Check that you copied the whole link, or ask its creator for a new one. You can still play the free demo.'
    : community && giftOpen ? `Claim the gear below, then fight under the ${name} sigil: it appears beside your name in matches, on your profile and in the weekly community ranking.`
    : community ? `Its sigil appears beside your name in matches, on your profile and in the weekly community ranking, where your ranked wins count for ${name}.`
    : giftOpen ? 'Claim this gear in the free demo. It goes to the account you play with.'
    : 'It has expired, was withdrawn or has already been claimed. You can still play the free demo.';
  const launchQuery = giftOpen ? `gift=${gift!.token}` : community ? `community=${community.id}` : '';
  const expiry = giftOpen && gift!.expiresAt
    ? `Available until ${new Date(gift!.expiresAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})}. `
    : '';
  const fine = giftOpen
    ? `${expiry}${gift!.unlimited ? 'Every account can claim this gift once.' : 'This gift can be claimed by one account.'} Opening it again never grants it twice.`
    : '';
  const crest = community
    ? `<div class="crest">${sigilSvgMarkup(community.sigil, {size: 168, id: 'invite-sigil', label: `${community.name} sigil`})}</div>`
    : `<div class="crest crest-gift"><img src="/assets/gold_chest.png" alt="" width="150" height="128"></div>`;
  const eyebrow = community ? `<p class="eyebrow"><span class="tag">${tag}</span> Creator community</p>`
    : `<p class="eyebrow">${invalid || !giftOpen ? 'Emberhall' : 'Creator gift'}</p>`;
  const rewards = giftOpen ? `<section class="rewards" aria-labelledby="rewards-title"><h2 id="rewards-title">Your gear</h2>`
    + `<ul class="reward-grid">${gift!.rewards.map(rewardTile).join('')}</ul>${fine ? `<p class="fine">${fine}</p>` : ''}</section>` : '';
  const steps = launchQuery ? `<ol class="steps">
      <li class="step"><span class="step-number">1</span><div><h2>Get the free demo</h2><p>Emberhall is free to try on Steam. Skip this if it’s already installed.</p>
        <a class="button button-secondary" href="${STORE_URL}"><img src="/assets/steam.png" alt="" width="24" height="24">Free demo on Steam</a></div></li>
      <li class="step"><span class="step-number">2</span><div><h2>${giftOpen && community ? 'Claim and join' : giftOpen ? 'Claim your gear' : 'Join the community'}</h2><p>Steam opens Emberhall${giftOpen ? ' and adds the gear to your account' : ''}${community ? `. Confirm to join ${name}` : ''}.</p>
        <a class="button button-primary" href="${escapeHTML(steamLaunch(launchQuery))}">Open in Emberhall</a></div></li>
    </ol>` : `<p class="actions"><a class="button button-primary" href="${STORE_URL}"><img src="/assets/steam.png" alt="" width="24" height="24">Play the free demo on Steam</a></p>`;
  const code = community ? `<p class="code-hint">Link not working? Enter <code>${escapeHTML(community.id.toUpperCase())}</code> on your profile under Join a community.</p>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Emberhall</title><meta name="robots" content="noindex"><link rel="icon" href="/assets/favicon.ico"><link rel="stylesheet" href="/invite.css"></head>
<body><header class="bar"><a href="/" aria-label="Emberhall home"><img src="/assets/logo.png" alt="Emberhall" class="logo" width="120" height="50"></a></header>
<main class="invite${community ? ' has-community' : ''}${giftOpen ? ' has-gift' : ''}">
<section class="hero" aria-labelledby="invite-title">${crest}<div class="hero-text">${eyebrow}<h1 id="invite-title">${title}</h1><p class="lead">${lead}</p></div></section>
${rewards}${steps}${code}
</main>
<div class="party" aria-hidden="true"><img src="/assets/warrior.png" alt="" width="220" height="220"><img src="/assets/whitemage.png" alt="" width="220" height="220"><img src="/assets/blackmage.png" alt="" width="220" height="220"></div>
<footer class="foot"><a href="/">play-legion.io</a><span>Turn-based PvP · Free demo on Steam</span></footer></body></html>`;
}
