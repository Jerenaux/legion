// DailyLootBox.tsx
import './DailyLootBox.style.css';
import { h, Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'

import { apiFetch } from '../../services/apiService';
import { errorToast } from '../utils';

interface DailyLootBoxProps {
    data: any
  }

class DailyLootBox extends Component<DailyLootBoxProps> {
  private timer: NodeJS.Timeout | null = null;

  state = {
    time: 0
  }

  componentDidMount(): void {
    // Get the target end time from localStorage or set it if not present
    const endTime = localStorage.getItem('countdownEndTime');
    const targetEndTime = endTime || new Date().getTime() + this.props.data.bronze.countdown * 1000;

    if (!endTime) {
      localStorage.setItem('countdownEndTime', targetEndTime.toString());
    }

    // this.setState({time: targetEndTime});

    this.timer = setInterval(() => {
      const currentTime  = new Date().getTime();
      const remainingTime = Math.max((targetEndTime as number - currentTime) / 1000, 0);

      this.setState({ time: remainingTime });

      if (remainingTime <= 0) {
        clearInterval(this.timer);
        localStorage.removeItem('countdownEndTime');
      }
    }, 1000);
  }
  
  componentWillUnmount(): void {
    if(this.timer) {
      clearInterval(this.timer);
    }
  }

  render() {
    const { data } = this.props;

    const countDown = {
      hour: Math.floor(Math.min(23, this.state.time / 3600)),
      minute: Math.floor((this.state.time % 3600) / 60),
      second: Math.floor(this.state.time % 60)
    };

    const handleOpen = async () => {
      // TODO: move
      try {
          const data = await apiFetch(`claimChest?chestType=silver`);
          console.log(data);
          // this.setState({ 
          //   ...data
          // });
      } catch (error) {
          errorToast(`Error: ${error}`);
      }
    }

    const handleReward = () => {
      console.log('Reward box');
    }

    return (
      <div className="dailyLootContainer">
        <BottomBorderDivider label='DAILY LOOTS' />
        {data ? <div className="dailyLoots">
          <div className="lootBoxContainer">
            <div className="loot-box-title"><span>Bronze Chest</span></div>
            <img className="loot-box-image" src="/shop/bronze_chest.png" alt="bronze" />
            <div className="loot-box-footer">Available in
              <span className="loot-box-countdown">
                {`${countDown.hour}`.padStart(2, "0")}:
                {`${countDown.minute}`.padStart(2, "0")}:
                {`${countDown.second}`.padStart(2, "0")}
              </span>
            </div>
          </div>
          <div className="lootBoxContainer" onClick={handleOpen}>
            <div className="loot-box-title"><span>Silver Chest</span></div>
            <img className="loot-box-image" src="/shop/silver_chest.png" alt="silver" />
            <div className="loot-box-footer">
              <img src="/shop/silver_key_icon.png" alt="key icon" />
              <span>0 / 1</span>
            </div>
          </div>
          <div className="lootBoxContainer" onClick={handleReward}>
            <div className="loot-box-title"><span>Golden Chest</span></div>
            <img className="loot-box-image" src="/shop/gold_chest.png" alt="gold" />
            <div className="loot-box-footer">
              <span className="loot-box-open">Open</span>
            </div>
          </div>
        </div> : <Skeleton
          height={100}
          count={1}
          highlightColor='#0000004d'
          baseColor='#0f1421'
          style={{ margin: '2px 0', width: '100%'}} />}
      </div>
    );
  }
}

export default DailyLootBox;