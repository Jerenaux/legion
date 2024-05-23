// SpectatorFooter.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface SpectatorFooterProps {

}

class SpectatorFooter extends Component<SpectatorFooterProps> {

  render() {
    return (
      <div className="spectator_footer_container">
        <div className="spectator_progress">
            <div className="spectator_progress_bar_bg">
              <div className="spectator_progress_fill"></div>
            </div>
            <div className="progress_ches_mark">
              <img src="/shop/bronze_chest.png" alt="" />
            </div>
            <div className="progress_chest_bronze">
              <img src="/shop/bronze_chest.png" alt="" />
            </div>
            <div className="progress_chest_silver">
              <img src="/shop/bronze_chest.png" alt="" />
            </div>
        </div>
        <div className="skip_tutorial">
          <span>Skip Tutorial</span>
        </div>
      </div>
    );
  }
}

export default SpectatorFooter;