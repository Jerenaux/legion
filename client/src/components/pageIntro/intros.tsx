// First-visit explanations for Play, Team and Shop. Roster and inventory sizes come from the
// shared config. Unlock thresholds are left to the UI's own locked states.
import {h} from 'preact';
import {t} from '../../i18n/core';
import {BASE_INVENTORY_SIZE, MAX_CHARACTERS, NB_START_CHARACTERS} from '@legion/shared/config';
import {Class} from '@legion/shared/enums';
import PageIntro, {type IntroStep} from './PageIntro';
import ClassCrest from '../HUD/ClassCrest';
import practiceIcon from '@assets/practice_icon.png';
import casualIcon from '@assets/casual_icon.png';
import rankedIcon from '@assets/ranked_icon.png';
import xpIcon from '@assets/game_end/XP_icon.png';
import goldIcon from '@assets/gold_icon.png';
import goldChest from '@assets/shop/gold_chest.png';
import consumablesIcon from '@assets/shop/consumables_icon.png';
import spellsIcon from '@assets/shop/spells_icon.png';
import equipmentIcon from '@assets/shop/helmet_icon.png';
import charactersIcon from '@assets/shop/char_icon.png';

const crests = <div className="page-intro-crests">
  {[Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].map(kind => <ClassCrest key={kind} characterClass={kind} />)}
</div>;

const icons = (sources: string[], className = 'page-intro-icons') => <div className={className}>
  {sources.map((src, index) => <img key={src} src={src} alt="" style={{'--order': index}} />)}
</div>;

type IntroProps = {uid: string; onClose: () => void};

export function PlayIntro({uid, onClose}: IntroProps) {
  const steps: IntroStep[] = [
    {
      title: t('Choose a mode'),
      art: icons([practiceIcon, casualIcon, rankedIcon]),
      rows: [
        {icon: practiceIcon, text: t('Practice: fight the AI. Reduced XP and gold, and your ELO never changes.')},
        {icon: casualIcon, text: t('Casual: fight other players for full rewards, with no ELO or league at stake.')},
        {icon: rankedIcon, text: t('Ranked: higher rewards; results count toward your ELO and the weekly league.')},
      ],
      lines: [],
    },
    {
      title: t('Every match moves you forward'),
      art: icons([xpIcon, goldIcon, goldChest]),
      lines: [
        t('Win or lose, your characters gain XP and you earn gold based on your performance grade.'),
      ],
    },
    {
      title: t('Your whole roster fights'),
      art: crests,
      lines: [
        t('Every character on your roster joins each match. Before you queue, spend stat points and equip items in Team.'),
        t('HP and MP refill after each battle, and knocked-out characters return.'),
      ],
    },
  ];
  return <PageIntro page="play" uid={uid} label={t('How matches work')} steps={steps} finishLabel={t('Got it')} onClose={onClose} />;
}

export function TeamIntro({uid, onClose}: IntroProps) {
  const steps: IntroStep[] = [
    {
      title: t('Your characters keep their progress'),
      art: crests,
      lines: [
        t('Levels, stats, learned spells and equipment stay with each character from match to match.'),
        t('No one is lost in battle: HP and MP refill afterwards, and knocked-out characters return.'),
        t('You start with {{value0}} characters; your roster can grow to {{value1}}.', {value0: NB_START_CHARACTERS, value1: MAX_CHARACTERS}),
      ],
    },
    {
      title: t('Levels and stat points'),
      art: <div className="page-intro-sp"><img src={xpIcon} alt="" /><span className="page-intro-arrow">→</span><span className="page-intro-sp-badge"><span><strong>+3</strong><small>{t('SP')}</small></span></span></div>,
      lines: [
        t('Characters earn XP in battle, shared by how many targets each one hit or helped.'),
        t('Each level raises their stats and grants at least 3 stat points (SP). Spend them with the + beside a stat: +10 HP or MP, or +1 to any other stat.'),
        t('Spent points are permanent, so build each character for their role.'),
      ],
    },
    {
      title: t('Equip before you fight'),
      art: icons([equipmentIcon, consumablesIcon, spellsIcon]),
      rows: [
        {icon: equipmentIcon, text: t('Equipment adds bonuses and can be swapped between matches. Check its class.')},
        {icon: consumablesIcon, text: t('Consumables fill carried-item slots and are used up in battle. Refill them after matches.')},
        {icon: spellsIcon, text: t('Learning a spell scroll is permanent and needs the right class and level. Casting costs MP.')},
      ],
      lines: [t('Owning an item isn’t enough: assign it to the character who needs it.')],
    },
  ];
  return <PageIntro page="team" uid={uid} label={t('How your team works')} steps={steps} finishLabel={t('Got it')} onClose={onClose} />;
}

export function ShopIntro({uid, onClose}: IntroProps) {
  const steps: IntroStep[] = [
    {
      title: t('Spend the gold you earn'),
      art: icons([goldIcon, goldChest]),
      lines: [
        t('Every match pays gold based on your grade. Ranked pays more; Practice pays less.'),
        t('Your gold is shown at the top of the Shop. Prices in red are out of reach for now.'),
      ],
    },
    {
      title: t('What the Shop sells'),
      art: icons([consumablesIcon, spellsIcon, equipmentIcon, charactersIcon]),
      rows: [
        {icon: consumablesIcon, text: t('Consumables: potions and remedies a character carries into battle. Each use spends one.')},
        {icon: spellsIcon, text: t('Spell scrolls: teach a character a new spell for good.')},
        {icon: equipmentIcon, text: t('Equipment: stat bonuses you can swap between matches.')},
        {icon: charactersIcon, text: t('Characters: new recruits to grow your roster.')},
      ],
      lines: [t('More of each opens up as you play.')],
    },
    {
      title: t('Purchases go to your inventory'),
      art: icons([consumablesIcon, spellsIcon, equipmentIcon]),
      lines: [
        t('Everything you buy lands in the shared inventory. Assign it to a character in Team before battle.'),
        t('The inventory holds {{value0}} items to start; buy more slots with the + in Team. Selling an item returns half its price.', {value0: BASE_INVENTORY_SIZE}),
      ],
    },
  ];
  return <PageIntro page="shop" uid={uid} label={t('How the Shop works')} steps={steps} finishLabel={t('Got it')} onClose={onClose} />;
}
