// SpectatorFooter.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface SpectatorFooterProps {
  isTutorial: boolean; 
  score: number;
}

class SpectatorFooter extends Component<SpectatorFooterProps> {
  render() { 
    console.log('propsScore -> ', this.props.score);
    return (
      <div className="spectator_footer_container"> 
      {/* {'spectatorScore' + this.props.score} */}
        <div className="spectator_progress">
            <div className="spectator_progress_bar_bg">
              <div className="spectator_progress_fill"></div>
            </div>
            <div className="progress_ches_mark" style={{left: `calc(${this.props.score / 1500 * 96}% - 12px)`}}>
              <img src="/shop/bronze_chest.png" alt="" />
            </div>
            <div className="progress_chest_bronze">
              <img src="/shop/bronze_chest.png" alt="" />
            </div>
            <div className="progress_chest_silver">
              <img src="/shop/bronze_chest.png" alt="" />
            </div> 
        </div>
        {this.props.isTutorial && <div className="skip_tutorial">
          <span>Skip Tutorial</span>
        </div>}
      </div>
    );
  }
}

export default SpectatorFooter;