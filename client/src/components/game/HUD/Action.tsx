import { h, Component } from 'preact';
import { ActionType } from './ActionTypes';
import InfoBox from '../../InfoBox';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";

interface ActionItemProps {
  action: BaseItem | BaseSpell;
  index: number;
  clickedIndex: number;
  canAct: boolean;
  actionType: ActionType;
  hideHotKey?: boolean;
  onActionClick?: (type: string, letter: string, index: number) => void;
}

class Action extends Component<ActionItemProps> {
  render() {
    const { action, index, clickedIndex, canAct, actionType, hideHotKey, onActionClick } = this.props;
    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const startPosition = keyboardLayout.indexOf(actionType === 'item' ? 'Z' : 'Q');
    const keyBinding = keyboardLayout.charAt(startPosition + index);
    return (
      <div 
        className={`${actionType} ${index === clickedIndex ? 'flash-effect' : ''}`} 
        onClick={() => onActionClick(actionType, keyBinding, index)}>
        {action.id > -1 && <div 
          className={!canAct ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
          style={{backgroundImage: `url(/assets/${actionType}s/${action.frame})`, cursor: 'pointer'}}
          />}
        {!hideHotKey && <span className="key-binding">{keyBinding}</span>}
        {action.id > -1 && <div className="info-box box">
          <InfoBox action={action} />
        </div>}
      </div>
    );
  }
}

export default Action;