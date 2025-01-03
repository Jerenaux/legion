// SpectatorFooter.tsx
import { h, Fragment, Component } from 'preact';
import { PlayMode } from '@legion/shared/enums';
import { TeamOverview } from "@legion/shared/interfaces";
import { getSpritePath } from '../utils';

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
}

class SpectatorFooter extends Component<SpectatorFooterProps> {
  render() {
    const { isTutorial, queue, team1, team2, closeGame } = this.props;

    const getCharacterFromQueue = (queueItem: { team: number; num: number }) => {
      const team = queueItem.team === 1 ? team1 : team2;
      return team?.members[queueItem.num - 1];
    };

    // Sort queue by position
    const sortedQueue = [...(queue || [])].sort((a, b) => a.position - b.position);

    return (
      <div className="spectator_footer_wrapper">
        <div className="spectator_footer_container">
          <div className="turn_timeline">
            {sortedQueue.map((queueItem, index) => {
              const character = getCharacterFromQueue(queueItem);
              if (!character) return null;

              const portraitStyle = {
                backgroundImage: `url(${getSpritePath(character.texture)})`,
              };

              return (
                <div 
                  key={index} 
                  className={`timeline_character ${queueItem.team === 1 ? 'timeline_ally' : 'timeline_enemy'}`}
                >
                  <div className="timeline_portrait_container">
                    <div 
                      className="timeline_portrait" 
                      style={portraitStyle}
                    />
                  </div>
                  {index < sortedQueue.length - 1 && (
                    <div className="timeline_arrow">→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {isTutorial && (
          <div className="skip_tutorial" onClick={closeGame}>
            <span>Skip Tutorial</span>
          </div>
        )}
      </div>
    );
  }
}

export default SpectatorFooter;
