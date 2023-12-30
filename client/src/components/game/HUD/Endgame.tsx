import { h, Component } from 'preact';
/* eslint-disable react/prefer-stateless-function */
export class Endgame extends Component {
    render() {
        return (
            <div className="endgame">
                <div className="endgame-head">
                    <div className="endgame-title">Victory!</div>
                    <div className="endgame-rewards">
                        <div className="endgame-gold" title='Gold'>
                            <span className="endgame-gold-logo">G</span>
                            <span className="endgame-gold-value">200</span>
                        </div>
                        <div className="endgame-xp">540</div>
                    </div>
                </div>
                {/* <div className="endgame-button">Close</div> */}
            </div>
        );
    }
}