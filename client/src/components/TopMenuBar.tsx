// TopMenuBar.js
import { h } from 'preact';

const TopMenuBar = () => (
  <div className="topMenu">
    <div className="leftSection">
      <div className="avatar">
      </div>
      <div className="avatarName">AVATAR NAME</div>
      <div className="level">Lv.13</div>
    </div>
    <div className="centerSection">
      <button className="playButton">PLAY</button>
      <button className="teamButton">TEAM</button>
      <button className="shopButton">SHOP</button>
      <button className="rankButton">RANK</button>
    </div>
    <div className="rightSection">
      <div className="currency">
        3.000.000
      </div>
      <div className="gems">
        1.235
      </div>
      <div className="elo">
        5.302 elo
      </div>
    </div>
  </div>
);

export default TopMenuBar;
