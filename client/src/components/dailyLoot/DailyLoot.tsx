import {userError} from '../../i18n/core';
import { h } from 'preact';
// DailyLootBox.tsx
import './DailyLoot.style.css';
import { Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import Ghost from '../ghost/Ghost';

import { useWindowSize } from '@react-hook/window-size';

import { apiFetch, apiMutation } from '../../services/apiService';
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
  /**
   * Content of openable chests, rolled ahead so the reveal needn't wait for the claim. 'stale' means
   * the server says the chest can't be opened (another session opened it); null means unknown.
   */
  private peeks = new Map<ChestColor, Promise<ChestReward[] | 'stale' | null>>();
  private peekTimers = new Map<ChestColor, ReturnType<typeof setTimeout>>();

  componentDidMount() {
    this.peekOpenableChests();
  }

  componentDidUpdate() {
    this.peekOpenableChests();
  }

  componentWillUnmount() {
    this.peekTimers.forEach(timer => { clearTimeout(timer); });
  }

  private peekOpenableChests() {
    const {data} = this.props;
    if (!data) return;
    for (const color of Object.values(ChestColor)) {
      const chest = data[color];
      if (!chest?.hasKey || this.peeks.has(color) || this.peekTimers.has(color)) continue;
      if (chest.countdown > 0) {
        // Peek as soon as the countdown ends.
        this.peekTimers.set(color, setTimeout(() => {
          this.peekTimers.delete(color);
          this.peek(color);
        }, chest.countdown * 1000));
      } else this.peek(color);
    }
  }

  private peek(color: ChestColor) {
    if (this.peeks.has(color)) return;
    this.peeks.set(color, apiFetch('peekChest', {method: 'POST', body: {chestType: color}})
      .then(result => (result?.content as ChestReward[]) ?? null)
      .catch(error => error?.status === 409 ? 'stale' as const : null));
  }

  render() {
    const { data } = this.props;
    const chestsOrder = [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD];

    const handleOpen = async (color: ChestColor) => {

      if (this.opening) return true;
      const pending = this.peeks.get(color);
      this.peeks.delete(color);
      // Another session already opened it: refresh instead of revealing.
      const peeked = await pending;
      if (peeked === 'stale') {
        await this.context.refreshAllData();
        return false;
      }
      this.opening = true;
      // Show the reveal at once. Content rolled in advance is what the claim pays, so it is revealed
      // without waiting and the claim runs in the background; otherwise the chest rattles until it returns.
      this.setState({
        chestColor: color,
        chestContent: peeked || null,
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
