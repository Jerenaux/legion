// Effect.tsx
import { h, Component } from 'preact';

interface DescProps {
  action: any;
}

class Description extends Component<DescProps> {
  render() {
    const { action } = this.props;
    return (
      <div>  
        {
          action.effects && action.effects.map((effect) => {
            const value = effect.value == -1 ? 'FULL' : `+${effect.value}`;
            return (
            <div className="hp mini">  
              <span className="mp-label">{effect.stat}</span>
              <span className="mp-amount">{value}</span>
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
    );
  }
}

export default Description;