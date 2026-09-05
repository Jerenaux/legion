import "./PlayModes.style.css";
import { h, Component } from "preact";
import PlayModeButton from "../playModeButton/playModeButton";
import { PlayMode, LockedFeatures } from "@legion/shared/enums";
import { PlayerContext } from "../../contexts/PlayerContext";
import { lockIcon } from "../utils";
import BottomBorderDivider from "../bottomBorderDivider/BottomBorderDivider";

enum MiddleBtns {
  PRACTICE = "practice",
  CASUAL = "casual",
  RANKED = "ranked",
}

class PlayModes extends Component {
  static contextType = PlayerContext;

  render() {
    const isRankedUnlocked = this.context.canAccessFeature(LockedFeatures.RANKED_MODE);

    return (
      <div className="barContainer">
        <div className="playModesContainer">
          <BottomBorderDivider label="PLAY MODES" />
        </div>
        <div className="playModesRow">
          <PlayModeButton label={MiddleBtns.PRACTICE} mode={PlayMode.PRACTICE} data-playmode="practice" />
          <PlayModeButton
            label={MiddleBtns.CASUAL}
            mode={PlayMode.CASUAL}
            players={Math.floor(Math.random() * 4) + 1}
            data-playmode="casual"
          />
          <PlayModeButton
            label={MiddleBtns.RANKED}
            players={Math.floor(Math.random() * 2) + 1}
            data-playmode="ranked"
            mode={PlayMode.RANKED}
            disabled={!isRankedUnlocked}
            lockIcon={!isRankedUnlocked ? lockIcon : undefined}
            gamesUntilUnlock={!isRankedUnlocked ? this.context.getGamesUntilFeature(LockedFeatures.RANKED_MODE) : 0}
          />
        </div>
      </div>
    );
  }
}

export default PlayModes;
