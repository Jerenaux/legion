import { Component, h } from 'preact';
import { PlayerContextState, PlayerContextData, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';
import { APIPlayerData } from '@legion/shared/interfaces';


class PlayerProvider extends Component<{}, PlayerContextState> {
    constructor(props: {}) {
      super(props);
      this.state = {
        player: {
          name: '',
          lvl: 0,
          gold: 0,
          elo: 0,
          ranking: 0,
          dailyloot: null,
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
      try {
          const data = await apiFetch('getPlayerData') as APIPlayerData;
          console.log(data);
          this.setState({ 
              player: {
                  name: data.name,
                  lvl: data.lvl,
                  gold: data.gold,
                  elo: data.elo,
                  ranking: data.rank,
                  dailyloot: data.dailyloot
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
  