// Effect.tsx
import { h, Component } from 'preact';
import { Stat, Target } from '@legion/shared/types';

interface DescProps {
  action: any;
}

class Description extends Component<DescProps> {
  render() {
    const { action } = this.props;
    return (
      <div className="description-area">  
        {
          action.effects && action.effects.map((effect) => {
            const value = effect.value == -1 ? 'FULL' : effect.value > 0 ? `+${effect.value}` : effect.value;
            const className = effect.stat == Stat.HP && effect.target == Target.SELF ? 'dmg' : `${Stat[effect.stat].toLowerCase()}`;
            return (
            <div key={effect} className={`badge ${className}`}>  
              <div className="badge-label">{Stat[effect.stat]}</div>
              <div>{value}</div>
            </div>
            );
          })
        }
        <div className='badge cooldown' title='Cooldown'>
          <span className="badge-label">⏳ </span> 
          <span>{action.cooldown}s</span>
        </div>
        <div className='badge target' title='Target type'>
          <span className="badge-label">🎯 </span> 
          <span>{Target[action.target]}</span>
        </div>
      </div>
    );
  }
}

export default Description;