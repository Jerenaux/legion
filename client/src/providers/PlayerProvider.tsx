import { Component, h } from 'preact';
import { PlayerContextState, PlayerContextData, PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from '../components/utils';
import { APIPlayerData, APICharacterData } from '@legion/shared/interfaces';
import { League, Stat, StatFields } from "@legion/shared/enums";
import { firebaseAuth } from '../services/firebaseService'; 
import { getSPIncrement } from '@legion/shared/levelling';

class PlayerProvider extends Component<{}, PlayerContextState> {
    constructor(props: {}) {
      super(props);
      this.state = {
        player: {
          uid: '',
          name: '',
          avatar: '0',
          lvl: 0,
          gold: 0,
          elo: 0,
          wins: 0,
          rank: 0,
          allTimeRank: 0,
          dailyloot: null,
          league: League.BRONZE,
          tours: [],
          isLoaded: false,
        },
        characters: [],
        characterSheetIsDirty: false,
      };

      // Bind the methods to ensure 'this' refers to the class instance
      this.fetchPlayerData = this.fetchPlayerData.bind(this);
      this.setPlayerInfo = this.setPlayerInfo.bind(this);
      this.fetchRosterData = this.fetchRosterData.bind(this);
      this.updateCharacterStats = this.updateCharacterStats.bind(this);
      this.getCharacter = this.getCharacter.bind(this);
    }

    componentDidMount() {
      this.fetchPlayerData();
      this.fetchRosterData();
    }
    
    async fetchPlayerData() {
      const user = firebaseAuth.currentUser;
      if (!user) {
          return;
          // throw new Error("No authenticated user found");
      }
      try {
          const data = await apiFetch('getPlayerData') as APIPlayerData;
          this.setState({ 
              player: {
                  uid: user.uid,
                  name: data.name,
                  avatar: data.avatar,
                  lvl: data.lvl,
                  gold: data.gold,
                  elo: data.elo,
                  wins: data.wins,
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

    async fetchRosterData() {
      try {
        const data = await apiFetch('rosterData');
        this.setState({
          characters: data.characters
        });
      } catch (error) {
        errorToast(`Error: ${error}`);
      }
    }

    updateCharacterStats = (characterId: string, stat: Stat, amount: number): void => {
      this.setState((prevState) => {
        const updatedCharacters = prevState.characters.map((character) => {
          if (character.id === characterId) {
            const newStats = { ...character.stats };
            newStats[StatFields[stat]] += getSPIncrement(stat) * amount;
            return {
              ...character,
              stats: newStats,
              sp: character.sp - amount,
            };
          }
          return character;
        });
  
        return { 
            characterSheetIsDirty: true,
            characters: updatedCharacters
          };
      });
    }

    getCharacter = (characterId: string): APICharacterData | undefined => {
      return this.state.characters.find(char => char.id === characterId);
    }
  
    render() {
      const { children } = this.props;
  
      return (
        <PlayerContext.Provider value={{
          player: this.state.player,
          characters: this.state.characters,
          characterSheetIsDirty: this.state.characterSheetIsDirty,
          setPlayerInfo: this.setPlayerInfo,
          refreshPlayerData: this.fetchPlayerData,
          fetchRosterData: this.fetchRosterData,
          updateCharacterStats: this.updateCharacterStats,
          getCharacter: this.getCharacter
        }}>
          {children}
        </PlayerContext.Provider>
      );
    }
  }
  
  export default PlayerProvider;
  