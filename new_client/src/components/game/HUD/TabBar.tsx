import { h } from 'preact';

const TabBar = ({ title = 'HP', value, maxValue, barClass = '' }) => {
    const difference = maxValue - value;
    const percentage = (value / maxValue) * 100;

    return (
        <div>
            <div className="bar-title">
                {title} <span className="bigger-number">{value}</span> / {maxValue} 
                { difference > 0 && 
                    <span className="smaller-number">-{difference}</span>
                }
                { difference > 0 && 
                    <span className="smaller-number">{percentage.toFixed(0)}%</span>
                }
            </div>
            <div className="hud-bar-bg">
                <div className={`hud-bar ${barClass}`} style={{width: `${percentage}%`}} />
            </div>
        </div>
    );
}

export default TabBar;
