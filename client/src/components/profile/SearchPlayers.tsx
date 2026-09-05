import { h, Component } from "preact";
import { avatarContext } from "../utils";
import debounce from "lodash/debounce";
import { apiFetch } from "../../services/apiService";
import { PlayerContext } from "../../contexts/PlayerContext";

interface PlayerSearchResult {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  onAddFriend: (playerId: string) => void;
}

interface State {
  searchTerm: string;
  results: PlayerSearchResult[];
  isLoading: boolean;
  error: string | null;
  showResults: boolean;
}

class SearchPlayers extends Component<Props, State> {
  static contextType = PlayerContext;
  searchCache: Map<string, PlayerSearchResult[]> = new Map();

  state: State = {
    searchTerm: "",
    results: [],
    isLoading: false,
    error: null,
    showResults: false,
  };

  debouncedSearch = debounce(async (term: string) => {
    if (term.length < 3) {
      this.setState({ results: [], isLoading: false });
      return;
    }

    // Check cache first
    if (this.searchCache.has(term)) {
      const cachedResults = this.searchCache.get(term) || [];
      // Filter out current user from cached results
      const filteredResults = this.filterOutCurrentUser(cachedResults);
      this.setState({
        results: filteredResults,
        isLoading: false,
      });
      return;
    }

    this.setState({ isLoading: true });

    try {
      const results = await apiFetch(`searchPlayers?search=${encodeURIComponent(term)}`);
      // Filter out current user from API results
      const filteredResults = this.filterOutCurrentUser(results);
      this.searchCache.set(term, results); // Cache the original results
      this.setState({
        results: filteredResults,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      this.setState({
        error: "Failed to search players",
        isLoading: false,
      });
    }
  }, 300);

  filterOutCurrentUser = (results: PlayerSearchResult[]) => {
    const currentUserId = this.context.player.uid;
    return results.filter((player) => player.id !== currentUserId);
  };

  handleSearchInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.setState({
      searchTerm: input.value,
      showResults: true,
    });
    this.debouncedSearch(input.value);
  };

  handleBlur = () => {
    // Delay hiding results to allow click events to fire
    setTimeout(() => {
      this.setState({ showResults: false });
    }, 200);
  };

  isAlreadyFriend = (playerId: string) => {
    return this.context.friends.some((friend) => friend.id === playerId);
  };

  render() {
    const { searchTerm, results, isLoading, error, showResults } = this.state;

    return (
      <div className="search-players">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search for friend by nickname"
            value={searchTerm}
            onInput={this.handleSearchInput}
            onBlur={this.handleBlur}
            onFocus={() => this.setState({ showResults: true })}
          />
          {isLoading && <div className="search-loading">Loading...</div>}
        </div>

        {showResults && searchTerm.length >= 3 && (
          <div className="search-results">
            {error && <div className="search-error">{error}</div>}

            {results.length > 0 ? (
              <div className="results-list">
                {results.map((player) => (
                  <div key={player.id} className="player-result">
                    <div className="player-info">
                      <div
                        className="player-avatar"
                        style={{
                          backgroundImage: `url(${avatarContext(`./${player.avatar}.png`)})`,
                        }}
                      />
                      <span className="player-name">{player.name}</span>
                    </div>
                    {this.isAlreadyFriend(player.id) ? (
                      <button className="add-friend-btn is-friend">Already Friends</button>
                    ) : (
                      <button className="add-friend-btn" onClick={() => this.props.onAddFriend(player.id)}>
                        Add Friend
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              searchTerm.length >= 3 && !isLoading && <div className="no-results">No players found</div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default SearchPlayers;
