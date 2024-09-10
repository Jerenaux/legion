// SpectatorFooter.tsx
import { h, Component } from 'preact';
import { PlayMode } from '@legion/shared/enums';
interface SpectatorFooterProps {
  isTutorial: boolean; 
  score: number;
  mode: PlayMode;
}

class SpectatorFooter extends Component<SpectatorFooterProps> {
  render() { 
    const showChests = this.props.mode != PlayMode.PRACTICE && this.props.mode != PlayMode.TUTORIAL;

    return (
      <div className="spectator_footer_container"> 
        <div className="spectator_progress">
            <div className="spectator_progress_bar_bg">
              <div className="spectator_progress_fill">
                <div className="spectator_progress_fill_mask" style={{width: `${100 - this.props.score / 1500 * 100}%`}}>

                </div>
              </div>
            </div>
            {showChests &&
              <div className="progress_ches_mark">
                <img src="/shop/bronze_chest.png" alt="" />
              </div>
            }
            {showChests &&
              <div className="progress_chest_bronze">
                <img src="/shop/bronze_chest.png" alt="" />
              </div>
            }
            {showChests &&
              <div className="progress_chest_silver">
                <img src="/shop/bronze_chest.png" alt="" />
              </div> 
            }
            
        </div>
        {this.props.isTutorial && <div className="skip_tutorial">
          <span>Skip Tutorial</span>
        </div>}
      </div>
    );
  }
}

export default SpectatorFooter;