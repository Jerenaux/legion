import {userError} from '../../i18n/core';
import { h } from 'preact';
// DailyLootBox.tsx
import './DailyLoot.style.css';
import { Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import Ghost from '../ghost/Ghost';

import { useWindowSize } from '@react-hook/window-size';

import { apiMutation } from '../../services/apiService';
import { silentErrorToast, } from '../utils';
import { ChestColor } from "@legion/shared/enums";
import { DailyLootAllAPIData, ChestReward } from "@legion/shared/interfaces";
import LootBox from "./LootBox";
import { PlayerContext } from '../../contexts/PlayerContext';
import OpenedChest from '../dailyLoot/OpenedChest';

interface DailyLootProps {
  data: DailyLootAllAPIData,
  /** Chests placed in the Play hall scene: no section label, no card frames. */
  scene?: boolean,
}

interface DailyLootState {
  chestColor: ChestColor | null,
  chestContent: ChestReward[] | null,
  chestDailyLoot: DailyLootAllAPIData | null,
}

// The hearth shows a single chest: one ready to open (the richest first), otherwise the next to unlock.
function sceneChest(data: DailyLootAllAPIData): ChestColor[] {
  const richestFirst = [ChestColor.GOLD, ChestColor.SILVER, ChestColor.BRONZE].filter(color => data[color]);
  const ready = richestFirst.find(color => data[color].countdown <= 0 && data[color].hasKey);
  if (ready) return [ready];
  const next = richestFirst.reduce<ChestColor | null>((best, color) =>
    best === null || data[color].countdown < data[best].countdown ? color : best, null);
  return next ? [next] : [];
}

class DailyLoot extends Component<DailyLootProps, DailyLootState> {
  constructor(props) {
    super(props);
    this.state = {
      chestColor: null,
      chestContent: null,
      chestDailyLoot: null,
    }
  }

  static contextType = PlayerContext;

  opening = false;

  render() {
    const { data } = this.props;
    const chestsOrder = [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD];

    const handleOpen = async (color: ChestColor) => {

      if (this.opening) return true;
      this.opening = true;
       // Immediately show OpenedChest with loading state
      this.setState({
        chestColor: color,
        chestContent: null, // Indicates loading
        chestDailyLoot: null,
      });

      try {
        const data = await apiMutation('claimChest', {chestType: color});

        // Update state with fetched data
        this.setState({
          chestContent: data.content,
          chestDailyLoot: data.dailyloot
        });

      } catch (error) {
        this.setState({
          chestColor: null,
          chestContent: null,
          chestDailyLoot: null,
        });
        // Another session may have opened it since the last refresh.
        if (error?.status === 409) return false;
        silentErrorToast(userError(error));
      } finally {
        await this.context.refreshAllData();
        this.opening = false;
      }
      return true;
    }

    const chestConfirm = () => {
      this.setState({
        chestColor: null,
        chestContent: null,
        chestDailyLoot: null,
      });
    }

    const [width, height] = useWindowSize()

    return (
      <div className={`dailyLootContainer${this.props.scene ? ' dailyLootContainer--scene' : ''}`}>
        {!this.props.scene && <BottomBorderDivider label='DAILY LOOT' />}
        {data ? <div className="dailyLoots">
          {(this.props.scene ? sceneChest(data) : chestsOrder).map((color) => {
            const chest = data[color];

            if (chest) {
              return (
                <LootBox
                  key={color}
                  color={color}
                  timeRemaining={chest.countdown}
                  ownsKey={chest.hasKey}
                  onClick={() => handleOpen(color)}
                />
              );
            }
            return null;
          })}
        </div> : <Ghost height={100} />}
        {this.state.chestColor &&
          <OpenedChest
                width={width}
                height={height}
                color={this.state.chestColor}
                content={this.state.chestContent}
                onClick={chestConfirm}
            />}
      </div>
    );
  }
}

export default DailyLoot;
