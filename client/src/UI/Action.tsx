import { h, Component } from 'preact';

interface ActionItemProps {
  action: any;
  index: number;
  clickedIndex: number;
  canAct: boolean;
  keyboardLayout: string;
  actionType: string;
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
          style={{backgroundImage: action.quantity !== 0 ? `url(assets/${actionType}s/${action.frame})` : 'none'}}
          />
        {action.quantity !== 0 && <span className="item-qty">x{action.quantity}</span>}
        <span className="key-binding">{keyBinding}</span>
        <div className="info-box box">
          <div className="info-box-title">{action.name}</div>
          <div className="info-box-desc">{action.description}</div>
          {
            action.effects && action.effects.map((effect) => {
              return (
                <div className="hp mini">  
                <span className="mp-label">{effect.stat}</span>
                <span className="mp-amount">+{effect.value}</span>
              </div>
              );
            })
          }
          <div className="info-box-extra">
            <div className='badge'>
              <span className="badge-label">⏳ </span> 
              <span>{action.cooldown}s</span>
            </div>
            <div className='badge'>
              <span className="badge-label">🎯 </span> 
              <span>{action.target}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Action;