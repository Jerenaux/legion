// Roster.tsx
import { h, Component } from 'preact';
import CharacterCard from './CharacterCard';

import firebase from 'firebase/compat/app'
import firebaseConfig from '@legion/shared/firebaseConfig';
firebase.initializeApp(firebaseConfig);

interface RosterState {
  user: firebase.User | null;
  characters: any[];
}

class Roster extends Component<Object, RosterState> {
  authSubscription: firebase.Unsubscribe | null = null;

  componentDidMount() {
    this.authSubscription = firebase.auth().onAuthStateChanged((user) => {
      this.setState({ user }, () => {
        if (user) {
          console.log('User is logged in');
          this.fetchRosterData(this.state.user); 
        }
      });
    });
  }

  componentWillUnmount() {
    // Don't forget to unsubscribe when the component unmounts
    this.authSubscription();
  }

  async fetchRosterData(user) {
    user.getIdToken(true).then((idToken) => {
      // Make the API request, including the token in the Authorization header
      fetch(`${process.env.PREACT_APP_API_URL}/rosterData`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        this.setState({ 
          characters: data.characters,
        });
      })
      .catch(error => console.error('Error:', error));
    }).catch((error) => {
      console.error(error);
    });
  }

  render() {
    return (
      <div>
        <div className="section-title">Your Team</div>
        <div className="roster">
            {this.state.characters && this.state.characters.map(character => <CharacterCard {...character} />)}
        </div>
      </div>
    );
  }
}

export default Roster;