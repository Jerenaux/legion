import Shepherd from 'shepherd.js';
import { apiFetch } from '../services/apiService';

let tourLock = false;
export function startTour(page) {
    // console.log(`Starting tour for ${page}`);
    if (tourLock) return;
    tourLock = true;
    let tour;
    switch (page) {
        case 'rank':
            tour = startRankTour();
            break;
        case 'play':
            tour = startPlayTour();
            break;
        case 'team':
            tour = startTeamTour();
            break;
        case 'shop':
            tour = startShopTour();
            break;
        default:
            break;
    }
    tour.start();
    apiFetch('completeTour', {
        method: 'POST',
        body: {
            page
        }
    }).then(() => {
        tourLock = false;
    });
}

function getTour() {
    return new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: 'tour-step',
          scrollTo: true
        }
      });
}

function step(tour, text, attachTo, isLast = false) {
    const buttons = [];
    if (tour.steps.length > 0) {
        buttons.push({
            text: 'Back',
            action: tour.back
        });
    }
    if (isLast) {
        buttons.push({
            text: 'Complete',
            action: tour.complete
        });
    } else {
        buttons.push({
            text: 'Next',
            action: tour.next
        });
    }
    return {
        text,
        attachTo,
        buttons,
        cancelIcon: {
            enabled: true,
        },
        scrollTo: false,
      }
}

function startPlayTour() {
    // console.log('Starting play tour');
    const tour = getTour();
    tour.addStep(step(tour, 'This is the Play Page of your Player Dashboard! From here you can launch games and claim your daily loot!', null))
    tour.addStep(step(
        tour,
        'Use these flags to navigate between the different menus of the Player Dashboard!',
        {
            element: '.menuItems',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'These are your gold and your rank in your current league!',
        {
            element: '#goldEloArea',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'These are you characters, you can click on them to manage their stats and equipment!',
        {
            element: '.rosterContainer',
            on: 'top'
        })
    );
    tour.addStep(step(
        tour,
        'These 3 buttons allow you to start a game of your choice anytime you want!',
        {
            element: '.barContainer',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'The daily loot chests are available every 6, 12 and 24 hours; make sure to play a casual or ranked games to win the keys to open them!',
        {
            element: '.dailyLootContainer',
            on: 'top'
        }),
    );
    tour.addStep(step(
        tour,
        'Now just jump into a practice game and start playing!',
        {
            element: '#playmode_0',
            on: 'bottom'
        },
        true),
    );
    return tour;
}

function startTeamTour() {
    const tour = getTour();
    tour.addStep(step(tour, 'This is the Team Page. From here you can manage your inventory and your characters\' equipment, spells and stats!', null))
    tour.addStep(step(
        tour,
        'This is your inventory, where all the consumables, equipment and spells that you win and own are stored! Click on the item icons to see more details and equip them to your characters!',
        {
            element: '.inventoryFullContainer',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'Use these tabs to navigate between the different types of items in your inventory!',
        {
            element: '.inventoryCategories',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'This is the character sheet of the character you have selected. Here you can see their stats, level and experience, equipment and spells!',
        {
            element: '.team-content-card-container',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'Click on the character cards to switch to another character!',
        {
            element: '.rosterContainer',
            on: 'bottom'
        },
        true),
    );
    return tour;
}

function startShopTour() {
    const tour = getTour();
    tour.addStep(step(tour, 'This is the Shop Page. Here you can buy consumables, equipment, spells and even new characters to expand your team!', null))
    tour.addStep(step(
        tour,
        'These tabs allow you to navigate between the different types of items available in the shop, from top to bottom: Consumables, Equipment, Spells and Characters.',
        {
            element: '.shop-tabs-container',
            on: 'right'
        })
    );
    tour.addStep(step(
        tour,
        'These icons indicate the effects of items, the duration of the cooldown and the type of target.',
        {
            element: '.consumable-card-effect-container',
            on: 'right'
        })
    );
    tour.addStep(step(
        tour,
        'This is how much of that item you already own!',
        {
            element: '.consumable-card-info-box',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'And this is the price! Click on the item card to buy it!',
        {
            element: '.shop-card-price',
            on: 'bottom'
        },
        true),
    );
    return tour;
}

function startRankTour() {
    const tour = getTour();

    tour.addStep(step(tour, 'This is the Rank Page. Here you can check your ranking in your league\'s leaderboard or the all-time leaderboard and check out the top players of each league!', null))
    tour.addStep(step(
        tour,
        'Here you can see your current rank, the metric used to determine that rank and see when the current season ends.',
        {
            element: '.recap-single-container',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'These are some highlights of players who stand out in your league. Try to see if you can feature there!',
        {
            element: '.highlights-container',
            on: 'left'
        })
    );
    tour.addStep(step(
        tour,
        'This menu allows you to display the leaderboards of each league, from top to bottom: Bronze, Silver, Gold, Zenith, Apex, and All-time.',
        {
            element: '.rank-tab-container',
            on: 'right'
        })
    );
    tour.addStep(step(
        tour,
        'This is the leaderboard of the current league. You can sort is as you like and see which players might be promoted or demoted at the end of the season, and who will earn rewards.',
        {
            element: '.rank-table-container',
            on: 'top'
        },
        true)
    );
    
    return tour;
}