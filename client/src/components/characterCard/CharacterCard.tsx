import { h, Component } from 'preact';
import { route } from 'preact-router';
import { classEnumToString, getSpritePath } from '../utils';
import { APICharacterData } from '@legion/shared/interfaces';
import './ChracterCard.style.css';

const bgContext = require.context('@assets', false, /team_Bg_.*\.png$/);

class CharacterCard extends Component<APICharacterData> {
  state = {
    active: false
  }

  handleCardClick = () => {
    const { id } = this.props;
    route(`/team/${id}`);
  }

  getBgImagePath = (active: boolean) => {
    const fileName = `team_Bg_${active ? 'active' : 'idle'}.png`;
    try {
      return bgContext(`./${fileName}`);
    } catch (error) {
      console.error(`Failed to load background: ${fileName}`, error);
      return '';
    }
  }

  render() {
    const { portrait, name, class: characterClass, level } = this.props;
    const portraitStyle = {
      backgroundImage: `url(${getSpritePath(portrait)})`,
    };

    const bgStyle = {
      backgroundImage: `url(${this.getBgImagePath(this.state.active)})`,
      cursor: 'pointer'
    }

    return (
      <div className="cardContainer" style={bgStyle} onClick={this.handleCardClick} onMouseEnter={() => this.setState({ active: true })} onMouseLeave={() => this.setState({ active: false })}>
        <div className="characterLevel">
          <span className="level">Lvl</span>
          <span className="levelVal">{level}</span>
        </div>
        <div className="characterName">
          <span className="name">{name}</span>
          <span className="class">{classEnumToString(characterClass)}</span>
        </div>
        <div className="portraitContainer">
          <div className="portrait" style={portraitStyle} />
        </div>
        {this.props?.sp > 0 && (
          <div className="characterSp">
            SP
          </div>
        )}
      </div>
    );
  }
}

export default CharacterCard;