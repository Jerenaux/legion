import { h, Component } from 'preact';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'
import { PlayerContext } from '../contexts/PlayerContext';

/* eslint-disable react/prefer-stateless-function */
class ElysiumPage extends Component {
  static contextType = PlayerContext; 

  render() {
    return (
      <div>Hello
      </div>
    );
  }
}

export default ElysiumPage;