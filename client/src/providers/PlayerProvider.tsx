import { Component, h } from 'preact';
import { PlayerContextState, PlayerContextData, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';


class PlayerProvider extends Component<{}, PlayerContextState> {
    constructor(props: {}) {
      super(props);
      this.state = {
        player: {
          name: '',
          lvl: 0,
          gold: 0,
          elo: 0,
          ranking: 0
        }
      };
    }

    componentDidMount() {
        this.fetchPlayerData();
    }
    
    async fetchPlayerData() {
        try {
            const data = await apiFetch('getPlayerData');
            console.log(data);
            this.setState({ 
                player: {
                    name: data.name,
                    lvl: data.lvl,
                    gold: data.gold,
                    elo: data.elo,
                    ranking: data.ranking
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
          setPlayerInfo: this.setPlayerInfo
        }}>
          {children}
        </PlayerContext.Provider>
      );
    }
  }
  
  export default PlayerProvider;
  