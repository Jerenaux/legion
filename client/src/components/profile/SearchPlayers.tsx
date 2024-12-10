import { h, Component } from 'preact';
import { avatarContext } from '../utils';
import debounce from 'lodash/debounce';
import { apiFetch } from '../../services/apiService';

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
    searchCache: Map<string, PlayerSearchResult[]> = new Map();
    
    state: State = {
        searchTerm: '',
        results: [],
        isLoading: false,
        error: null,
        showResults: false
    };

    debouncedSearch = debounce(async (term: string) => {
        if (term.length < 3) {
            this.setState({ results: [], isLoading: false });
            return;
        }

        // Check cache first
        if (this.searchCache.has(term)) {
            this.setState({ 
                results: this.searchCache.get(term) || [],
                isLoading: false 
            });
            return;
        }

        this.setState({ isLoading: true });

        try {
            const results = await apiFetch(`searchPlayers?search=${encodeURIComponent(term)}`);
            this.searchCache.set(term, results);
            this.setState({ 
                results,
                error: null,
                isLoading: false
            });
        } catch (error) {
            this.setState({ 
                error: 'Failed to search players',
                isLoading: false
            });
        }
    }, 300);

    handleSearchInput = (event: Event) => {
        const input = event.target as HTMLInputElement;
        this.setState({ 
            searchTerm: input.value,
            showResults: true
        });
        this.debouncedSearch(input.value);
    };

    handleBlur = () => {
        // Delay hiding results to allow click events to fire
        setTimeout(() => {
            this.setState({ showResults: false });
        }, 200);
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
                                {results.map(player => (
                                    <div key={player.id} className="player-result">
                                        <div className="player-info">
                                            <div 
                                                className="player-avatar" 
                                                style={{ 
                                                    backgroundImage: `url(${avatarContext(`./${player.avatar}.png`)})` 
                                                }}
                                            />
                                            <span className="player-name">{player.name}</span>
                                        </div>
                                        <button 
                                            className="add-friend-btn"
                                            onClick={() => this.props.onAddFriend(player.id)}
                                        >
                                            Add Friend
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            searchTerm.length >= 3 && !isLoading && 
                            <div className="no-results">No players found</div>
                        )}
                    </div>
                )}
            </div>
        );
    }
}

export default SearchPlayers;