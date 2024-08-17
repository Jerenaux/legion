// DailyLootBox.tsx
import './DailyLoot.style.css';
import { h, Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';
import { RewardType } from '@legion/shared/chests';
import { mapFrameToCoordinates } from '../utils';

import { apiFetch } from '../../services/apiService';
import { errorToast, successToast } from '../utils';
import { ChestColor } from "@legion/shared/enums";
import { DailyLootAllAPIData } from "@legion/shared/interfaces";
import LootBox from "./LootBox";
import { PlayerContext } from '../../contexts/PlayerContext';


interface DailyLootProps {
  data: DailyLootAllAPIData, 
}

interface DailyLootState {
  chestColor: string,
  chestContent: any[], 
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

  getBgImageUrl = (rewardType: RewardType) => {
    switch (rewardType) {
      case RewardType.EQUIPMENT:
        return '/equipment.png';
      case RewardType.SPELL:
        return '/spells.png';
      case RewardType.CONSUMABLES:
        return '/consumables.png';
      case RewardType.GOLD:
        return '/gold_icon.png';
    }
  }

  render() {
    const { data } = this.props;
    const chestsOrder = [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD];

    const handleOpen = async (color: ChestColor, countdown: number, hasKey: boolean) => {
      // console.log("dailyPropsData => ", data); 

      // Check if countdown is over and if key is owned
      if (countdown > 0) {
        errorToast(`Chest locked, wait for the countdown to end!`);
        return;
      }
      if (!hasKey) {
        errorToast(`You need a key to open this chest, go play a casual or ranked game!`);
        return;
      }
      try {
        const data = await apiFetch(`claimChest?chestType=${color}`);
        console.log("successData => ", data);

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
      successToast("You got the daily loot successfully!"); 
    }

    const [width, height] = useWindowSize();

    return (
      <div className="dailyLootContainer">
        <BottomBorderDivider label='DAILY LOOT' />
        {data ? <div className="dailyLoots">
          {chestsOrder.map((color) => {
            const chest = data[color];
            // console.log("dailyChest => ", chest); 

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

        {!!this.state.chestColor && <div style={{top: `${document.documentElement.scrollTop}px`, overflow: "hidden", zIndex: "9999999999"}} className="light_streak_container">
          <div className="light_streak" style={{ width: width * 0.5 }}>
            <Confetti
              width={width * 0.5}
              height={height}
            />
            <div className="light_streak_chest">
              <img src={`/shop/${this.state.chestColor}_chest.png`} alt="" />
            </div>
            <div className="light_shining_bg">
              <img src="/game_end/shine_bg.png" alt="" />
            </div>
            <div className="streak_gold_list_container">
              {this.state.chestContent.map((reward, idx) => {
                // console.log('rewardItem ', idx, reward); 
                const coordinates = mapFrameToCoordinates(reward?.frame);
                const backgroundImageUrl = this.getBgImageUrl(reward?.type);
                return (
                  <div key={idx} className="streak_gold_list">
                    <div style={{
                      backgroundImage: `url(${backgroundImageUrl})`,
                      backgroundPosition: reward.type === RewardType.GOLD ? '' : `-${coordinates.x}px -${coordinates.y}px`,
                      backgroundSize: reward.type === RewardType.GOLD && '84% 100%',
                    }}></div>
                  </div>
                )
              })}
            </div>
            <div className="streak_cofirm_container" style={{ width: width * 0.8 }} onClick={chestConfirm}>
              <div className="streak_confirm_btn"><span>Confirm</span></div>
            </div>
          </div>
        </div>}
      </div>
    );
  }
}

export default DailyLoot;