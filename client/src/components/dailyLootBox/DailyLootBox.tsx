// DailyLootBox.tsx
import './DailyLootBox.style.css';
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';

interface DailyLootBoxProps {
    data: any
  }

class DailyLootBox extends Component<DailyLootBoxProps> {
  private timer: NodeJS.Timeout | null = null;

  state = {
    time: this.props.data.bronze.countdown
  }

  componentDidMount(): void {
    this.timer = setInterval(() => {
      this.setState({time: this.state.time - 1});
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
      hour: Math.floor(this.state.time / 3600),
      minute: Math.floor((this.state.time % 3600) / 60),
      second: this.state.time % 60
    };

    return (
      <div className="dailyLootContainer">
        <BottomBorderDivider label='DAILY LOOTS' />
        <div className="dailyLoots">
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
          <div className="lootBoxContainer">
            <div className="loot-box-title"><span>Silver Chest</span></div>
            <img className="loot-box-image" src="/shop/silver_chest.png" alt="silver" />
            <div className="loot-box-footer">
              <img src="/shop/silver_key_icon.png" alt="key icon" />
              <span>0 / 1</span>
            </div>
          </div>
          <div className="lootBoxContainer">
            <div className="loot-box-title"><span>Golden Chest</span></div>
            <img className="loot-box-image" src="/shop/gold_chest.png" alt="gold" />
            <div className="loot-box-footer">
              <span className="loot-box-open">Open</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default DailyLootBox;