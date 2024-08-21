import { Component, h } from 'preact';
import { PlayerContextState, PlayerContextData, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';
import { APIPlayerData } from '@legion/shared/interfaces';
import { League } from "@legion/shared/enums";
import { firebaseAuth } from '../services/firebaseService';

class PlayerProvider extends Component<{}, PlayerContextState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      player: {
        uid: '',
        name: '',
        avatar: '0',
        lvl: 0,
        gold: -1,
        elo: 0,
        rank: 0,
        allTimeRank: 0,
        dailyloot: null,
        league: League.BRONZE,
        tours: [],
        isLoaded: false,
      }
    };

    // Bind the methods to ensure 'this' refers to the class instance
    this.fetchPlayerData = this.fetchPlayerData.bind(this);
    this.setPlayerInfo = this.setPlayerInfo.bind(this);
  }

  componentDidMount() {
    this.fetchPlayerData();
  }

  async fetchPlayerData() {
    const user = firebaseAuth.currentUser;
    if (!user) {
      return;
      // throw new Error("No authenticated user found");
    }
    try {
      // await new Promise(resolve => setTimeout(resolve, 3000)); 
      const data = await apiFetch('getPlayerData') as APIPlayerData;
      console.log(data);
      this.setState({
        player: {
          uid: user.uid,
          name: data.name,
          avatar: data.avatar,
          lvl: data.lvl,
          gold: data.gold,
          elo: data.elo,
          rank: data.rank,
          allTimeRank: data.allTimeRank,
          dailyloot: data.dailyloot,
          league: data.league,
          tours: data.tours,
          isLoaded: true,
        }
      });
    } catch (error) {
      errorToast(`Error: ${error}`);
    }
  }

  setPlayerInfo = (updates: Partial<PlayerContextData>) => {
    this.setState(({ player }) => ({
      player: { ...player, ...updates }
    }));
  }

  render() {
    const { children } = this.props;
    const { player } = this.state;

    return (
      <PlayerContext.Provider value={{
        player,
        setPlayerInfo: this.setPlayerInfo,
        refreshPlayerData: this.fetchPlayerData
      }}>
        {children}
      </PlayerContext.Provider>
    );
  }
}

export default PlayerProvider;
