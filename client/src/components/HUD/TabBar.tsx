import { h } from 'preact';


const TabBar = ({ value, maxValue, barClass = '' }) => {
    const percentage = (value / maxValue) * 100;

    return (
        <div className="hud_bar_container">
            <div className="hud_bar_bg">
                <div className={barClass} style={{width: `${percentage}%`}} />
            </div>
            <p className="hud_bar_status"><span style={{color: '#71deff'}}>{value}</span> / <span>{maxValue}</span></p>
        </div>
    );
}

export default TabBar;
