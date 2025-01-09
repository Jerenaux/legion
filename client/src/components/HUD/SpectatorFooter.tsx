// SpectatorFooter.tsx
import { h, Fragment, Component } from 'preact';
import { PlayMode, Class } from '@legion/shared/enums';
import { TeamOverview } from "@legion/shared/interfaces";
import { getSpritePath } from '../utils';
import './SpectatorFooter.style.css';
import warriorIcon from '@assets/shop/warrior_icon.png';
import mageIcon from '@assets/shop/mage_icon.png';

interface SpectatorFooterProps {
  isTutorial: boolean;
  score: number;
  mode: PlayMode;
  queue: {
    num: any;
    team: number;
    position: number;
  }[];
  team1: TeamOverview;
  team2: TeamOverview;
  closeGame: () => void;
  isPlayer: boolean;
}

interface SpectatorFooterState {
  positions: { [key: string]: number };
}

class SpectatorFooter extends Component<SpectatorFooterProps, SpectatorFooterState> {
  state = {
    positions: {},
  };

  componentDidUpdate(prevProps: SpectatorFooterProps) {
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
    const { isTutorial, queue, team1, team2, closeGame } = this.props;
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
    const timerPosition = startOffset - 70 + 570; // Position timer just before the first portrait

    return (
      <div className="spectator_footer_wrapper">
        <div className="spectator_footer_container">
          <div className="turn_timeline_wrapper">
            <div className="turn_order_label">Turn Order</div>
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
                  backgroundImage: `url(${getSpritePath(character.texture)})`,
                };

                const characterKey = `${queueItem.team}-${queueItem.num}`;
                const position = positions[characterKey] || index;

                const style = {
                  transform: `translateX(${startOffset + (position * portraitWidth)}px)`,
                  zIndex: sortedQueue.length - position
                };

                return (
                  <div 
                    key={characterKey}
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
                      <div className={`timeline_class_indicator ${
                        character.class === Class.WARRIOR 
                          ? 'frame-warrior' 
                          : character.class === Class.BLACK_MAGE 
                          ? 'frame-black-mage'
                          : 'frame-white-mage'
                      }`}>
                        <img 
                          src={character.class === Class.WARRIOR ? warriorIcon : mageIcon}
                          className={`class-icon ${character.class === Class.WARRIOR ? 'warrior' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
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

export default SpectatorFooter;
