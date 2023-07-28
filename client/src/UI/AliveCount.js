// AliveCount.js
import { h, Component } from 'preact';

class AliveCount extends Component {
  render() {
    return <div className="alive-count">{this.props.count}</div>;
  }
}

export default AliveCount;
