import { h, Component } from 'preact';
import { ActionType } from './ActionTypes';
import InfoBox from '../../InfoBox';

interface ActionItemProps {
  action: any;
  index: number;
  clickedIndex: number;
  canAct: boolean;
  keyboardLayout: string;
  actionType: ActionType;
  onActionClick: (type: string, letter: string, index: number) => void;
}

class Action extends Component<ActionItemProps> {
  render() {
    const { action, index, clickedIndex, canAct, keyboardLayout, actionType, onActionClick } = this.props;
    const startPosition = keyboardLayout.indexOf(actionType === 'item' ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);

    return (
      <div 
        className={`${actionType} ${index === clickedIndex ? 'flash-effect' : ''}`} 
        onClick={() => onActionClick(actionType, keyBinding, index)}>
        <div 
          className={!canAct ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
          style={{backgroundImage: action.quantity || actionType == ActionType.Skill ? `url(assets/${actionType}s/${action.frame})` : 'none'}}
          />
        {action.quantity > 0 && <span className="item-qty">x{action.quantity}</span>}
        <span className="key-binding">{keyBinding}</span>
        <div className="info-box box">
          <InfoBox action={action} />
        </div>
      </div>
    );
  }
}

export default Action;