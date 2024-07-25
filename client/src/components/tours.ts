import Shepherd from 'shepherd.js';
import { apiFetch } from '../services/apiService';

export function startTour(page, todoTours) {
    // console.log(`Starting tour for ${page}`);
    if (!todoTours.includes(page)) {
        // console.log(`Tour for ${page} already completed`);
        return;
    }
    switch (page) {
        case 'rank':
            startRankTour();
            break;
        case 'play':
            startPlayTour();
            break;
        case 'team':
            startTeamTour();
            break;
        default:
            break;
    }
    apiFetch('completeTour', {
        method: 'POST',
        body: {
            page
        }
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
      }
}

function startPlayTour() {
    // console.log('Starting play tour');
    const tour = getTour();
    tour.addStep(step(tour, 'This is the Play Page. From here you can launch games, watch other player\'s games and claim your daily loot!', null))
    tour.addStep(step(
        tour,
        'Use these flags to navigate between the different menus!',
        {
            element: '.menuItems',
            on: 'bottom'
        })
    );
    tour.addStep(step(
        tour,
        'These are your gold, your rank in your starting league and your ELO rating!',
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
    tour.start();
}

function startTeamTour() {
    // Character sheet, character cards, inventory, inventory tabs
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
    tour.start();
}

function startRankTour() {
    const tour = getTour();

    tour.addStep(step(tour, 'This is the Rank Page. Here you can check your ranking in your league\'s leaderboard or the all-time leaderboard and check out the top players of each league!', null))
    tour.addStep(step(
        tour,
        'Here you can see your current rank and ELO rating and see when the current season ends.',
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
    
    tour.start();
}