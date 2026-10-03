import {t} from '../../i18n/core';
import { h } from 'preact';
// SpectatorFooter.tsx
import { Component } from 'preact';
import { PlayMode } from '@legion/shared/enums';
import { TeamOverview } from "@legion/shared/interfaces";
import { getSpritePath } from '../utils';
import './Timeline.style.css';
import ClassCrest from './ClassCrest';
import { CharacterHover, InspectCharacter } from './CharacterHoverCard';

interface TimelineProps {
  characterHover: CharacterHover | null;
  onInspect: InspectCharacter;
  isTutorial: boolean;
  score: number;
  mode: PlayMode;
  queue: {
    num: number;
    team: number;
    position: number;
  }[];
  team1: TeamOverview;
  team2: TeamOverview;
  closeGame: () => void;
  isPlayer: boolean;
}

interface TimelineState {
  positions: { [key: string]: number };
}

class Timeline extends Component<TimelineProps, TimelineState> {
  state = {
    positions: {},
  };

  componentDidUpdate(prevProps: TimelineProps) {
    if (prevProps.queue !== this.props.queue) {
      // Calculate new positions
      const newPositions = {};
      this.props.queue.forEach((item, index) => {
        const key = `${item.team}-${item.num}`;
        newPositions[key] = index;
      });

      this.setState({ positions: newPositions });
    }
  }

  render() {
    const { queue, team1, team2, characterHover, onInspect } = this.props;
    const { positions } = this.state;

    const getCharacterFromQueue = (queueItem: { team: number; num: number }) => {
      const team = queueItem.team === 1 ? team1 : team2;
      return team?.members[queueItem.num - 1];
    };

    // Sort queue by position
    const sortedQueue = [...(queue || [])].sort((a, b) => a.position - b.position);

    // Inside the render method, update the timeline calculations:
    const portraitWidth = 72; // Width of each portrait
    const timelineWidth = Math.max(100, sortedQueue.length * portraitWidth);
    const startOffset = (timelineWidth - sortedQueue.length * portraitWidth) / 2;

    return (
      <div className="spectator_footer_wrapper">
        <div className="spectator_footer_container">
          <div className="turn_timeline_wrapper">
            <div className="turn_order_label">{t("Turn Order")}</div>
            <div
              className="turn_timeline"
              style={{
                width: `${timelineWidth}px`,
                position: 'relative'
              }}
            >
              {sortedQueue.map((queueItem, index) => {
                const character = getCharacterFromQueue(queueItem);
                if (!character) return null;

                const portraitStyle = {
                  backgroundImage: `url(${getSpritePath(character.portrait)})`,
                };

                const inspected = characterHover?.team === queueItem.team && characterHover.num === queueItem.num;
                const characterKey = `${queueItem.team}-${queueItem.num}`;
                const position = positions[characterKey] || index;

                const style = {
                  transform: `translateX(${startOffset + (position * portraitWidth)}px)`,
                  zIndex: sortedQueue.length - position
                };

                return (
                  <button type="button" data-game-control
                    key={characterKey}
                    onClick={e => onInspect(queueItem.team, queueItem.num, e.currentTarget)}
                    aria-label={t("Inspect {{value0}}", {value0: character.name})}
                    aria-describedby={inspected ? 'character-hover-card' : undefined}
                    data-character={characterKey}
                    data-inspected={inspected}
                    onMouseEnter={e => onInspect(queueItem.team, queueItem.num, e.currentTarget)}
                    onMouseLeave={e => { if (!e.currentTarget.contains(document.activeElement)) onInspect(queueItem.team, queueItem.num, null); }}
                    onFocus={e => onInspect(queueItem.team, queueItem.num, e.currentTarget)}
                    onBlur={() => onInspect(queueItem.team, queueItem.num, null)}
                    className={`timeline_character ${queueItem.team === 1 ? 'timeline_ally' : 'timeline_enemy'}`}
                    style={style}
                  >
                    <div
                      className={`timeline_portrait_container ${queueItem.team === 1 ? 'ally_portrait' : 'enemy_portrait'}`}
                    >
                      <div
                        className="timeline_portrait"
                        style={portraitStyle}
                      />
                      <div className="timeline_class_indicator">
                        <ClassCrest characterClass={character.class} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* {isTutorial && (
          <div className="skip_tutorial" onClick={closeGame}>
            <span>Skip Tutorial</span>
          </div>
        )} */}
      </div>
    );
  }
}

export default Timeline;
