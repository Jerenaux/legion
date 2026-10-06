import {t} from '../../../i18n/core';
import { Fragment } from 'preact';
import { h } from 'preact';
import { Component } from 'preact';
import { route } from 'preact-router';
import { InventoryType } from "@legion/shared/enums";
import { mapFrameToCoordinates, cropFrame } from '../../utils';
import '../unlockedFeature/UnlockedFeature.style.css';

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

  // Put keyboard and controller focus on the main choice as soon as the reveal appears.
  focusOnMount = (button: HTMLButtonElement | null) => button?.focus({preventScroll: true});

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
      <div className="loot-popup-scrim">
        <div className="feature-reveal loot-popup" role="dialog" aria-modal="true" aria-labelledby="feature-reveal-title">
          <div className="feature-reveal-content">
            <h2 className="feature-reveal-header" id="feature-reveal-title">
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
                  <button type="button"
                    className="feature-reveal-button primary game-btn game-btn--gold"
                    ref={this.focusOnMount}
                    onClick={this.handleCheckout}
                  >{t("Check it out")}</button>
                  <button type="button"
                    className="feature-reveal-button secondary game-btn game-btn--ink"
                    data-desktop-cancel
                    onClick={this.props.onHide}
                  >{t("Dismiss")}</button>
                </>
              ) : (
                <button type="button"
                  className="feature-reveal-button primary game-btn game-btn--gold"
                  ref={this.focusOnMount}
                  data-desktop-cancel
                  onClick={this.props.onHide}
                >{t("Continue")}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}