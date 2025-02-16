import { h, Fragment, Component } from 'preact';
import { route } from 'preact-router';
import { InventoryType } from "@legion/shared/enums";
import { mapFrameToCoordinates, cropFrame } from '../../utils';
import './FeatureReveal.style.css';

import consumablesSpritesheet from '@assets/consumables.png';
import equipmentSpritesheet from '@assets/equipment.png';
import spellsSpritesheet from '@assets/spells.png';

interface Props {
  title: string;
  description: string;
  contentCategory: InventoryType;
  frame: number;
  route?: string;
  onHide: () => void;
}

interface State {
  croppedImageUrl: string | null;
}

export class FeatureReveal extends Component<Props, State> {
  state: State = {
    croppedImageUrl: null
  };

  componentDidMount() {
    this.cropSpritesheet();
  }

  cropSpritesheet = async () => {
    const { contentCategory, frame } = this.props;

    const spriteSheetsMap = {
      [InventoryType.CONSUMABLES]: consumablesSpritesheet,
      [InventoryType.SPELLS]: spellsSpritesheet,
      [InventoryType.EQUIPMENTS]: equipmentSpritesheet,
    };
    const spritesheet = spriteSheetsMap[contentCategory];

    const { x, y } = mapFrameToCoordinates(frame);
    try {
      console.log(`[FeatureReveal:cropSpritesheet] contentCategory: ${contentCategory}, frame: ${frame}, x: ${x}, y: ${y}, spritesheet: ${spritesheet}`);
      const croppedImageUrl = await cropFrame(spritesheet, x, y, 32, 32);
      this.setState({ croppedImageUrl });
    } catch (error) {
      console.error('Error cropping spritesheet:', error);
    }
  }

  handleCheckout = () => {
    if (this.props.route) {
      route(this.props.route);
    }
    this.props.onHide();
  };

  render() {
    const { title, description, route } = this.props;
    const { croppedImageUrl } = this.state;

    return (
      <div className="feature-reveal">
        <div className="feature-reveal-content">
          <h2 className="feature-reveal-header">
            {title}
          </h2>
          
          <div className="feature-reveal-icon">
            <div 
                className="feature-icon"
                style={{
                    backgroundImage: `url(${croppedImageUrl})`,
            }}
            />
          </div>

          <p className="feature-reveal-description" dangerouslySetInnerHTML={{ __html: description }} />

          <div className="feature-reveal-buttons">
            {route ? (
              <>
                <button 
                  className="feature-reveal-button primary" 
                  onClick={this.handleCheckout}
                >
                  Check it out
                </button>
                <button 
                  className="feature-reveal-button secondary" 
                  onClick={this.props.onHide}
                >
                  Dismiss
                </button>
              </>
            ) : (
              <button 
                className="feature-reveal-button primary" 
                onClick={this.props.onHide}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
} 