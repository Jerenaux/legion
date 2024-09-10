// DailyLootBox.tsx
import './DailyLoot.style.css';
import { h, Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

import { useWindowSize } from '@react-hook/window-size';
import { ChestReward } from '@legion/shared/chests';

import { apiFetch } from '../../services/apiService';
import { errorToast, successToast } from '../utils';
import { ChestColor } from "@legion/shared/enums";
import { DailyLootAllAPIData } from "@legion/shared/interfaces";
import LootBox from "./LootBox";
import { PlayerContext } from '../../contexts/PlayerContext';
import OpenedChest from '../dailyLoot/OpenedChest';
import { IMMEDIATE_LOOT } from '@legion/shared/config';

interface DailyLootProps {
  data: DailyLootAllAPIData, 
}

interface DailyLootState {
  chestColor: ChestColor,
  chestContent: ChestReward[], 
  chestDailyLoot: any, 
}

class DailyLoot extends Component<DailyLootProps, DailyLootState> {
  constructor(props) {
    super(props);
    this.state = {
      chestColor: null,
      chestContent: [], 
      chestDailyLoot: null, 
    }
  }

  static contextType = PlayerContext;

  render() {
    const { data } = this.props;
    const chestsOrder = [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD];

    const handleOpen = async (color: ChestColor, countdown: number, hasKey: boolean) => {

      // Check if countdown is over and if key is owned
      if (countdown > 0 && !IMMEDIATE_LOOT) {
        errorToast(`Chest locked, wait for the countdown to end!`);
        return;
      }
      if (!hasKey && !IMMEDIATE_LOOT) {
        errorToast(`You need a key to open this chest, go play a casual or ranked game!`);
        return;
      }
      try {
        const data = await apiFetch(`claimChest?chestType=${color}`);
        this.context.refreshAllData();

        this.setState({ chestColor: color });
        this.setState({ chestContent: data.content }); 
        this.setState({ chestDailyLoot: data.dailyloot}); 

      } catch (error) {
        errorToast(`Error: ${error}`);
      }
    } 

    const chestConfirm = () => { 
      this.context.setPlayerInfo({ dailyloot: this.state.chestDailyLoot }); 
      this.setState({
        chestColor: null, 
        chestContent: [], 
        chestDailyLoot: null, 
      });
      successToast("Chest claimed successfully!"); 
    }

    const [width, height] = useWindowSize()

    return (
      <div className="dailyLootContainer">
        <BottomBorderDivider label='DAILY LOOT' />
        {data ? <div className="dailyLoots">
          {chestsOrder.map((color) => {
            const chest = data[color];

            if (chest) {
              return (
                <LootBox
                  key={color}
                  color={color}
                  timeRemaining={chest.countdown}
                  ownsKey={chest.hasKey}
                  onClick={() => handleOpen(color, chest.countdown, chest.hasKey)}
                />
              );
            }
            return null;
          })}
        </div> : <Skeleton
          height={100}
          count={1}
          highlightColor='#0000004d'
          baseColor='#0f1421'
          style={{ margin: '2px 0', width: '100%' }} />}
        {!!this.state.chestColor && 
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