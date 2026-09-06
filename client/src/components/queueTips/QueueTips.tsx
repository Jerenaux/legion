
import { h } from 'preact';
import { Component } from 'preact';
import { tips } from '../tips'
import './QueueTips.style.css';

export interface QueueTipsState {
    tipCount: number;
    tips: string[];
}

export class QueueTips extends Component<{}, QueueTipsState> {
    state = {
        tipCount: 0,
        tips: [] as string[],
    };

    componentDidMount() {
        this.setState({
            tips: tips.sort(() => Math.random() - 0.5),
        });
    }

    prevTip = () => {
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount - 1 + prevState.tips.length) % prevState.tips.length
        }));
    }

    nextTip = () => {
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount + 1) % prevState.tips.length
        }));
    }

    render() {
        return (
            <div className="queue-tips">
                <div className="queue-tips-container">
                    <div style="font-family: Kim;">Tips</div>
                    <div>
                        <span className="queue-tips-text">
                            {this.state.tips[this.state.tipCount]}
                        </span>
                    </div>
                </div>
                <button type="button" data-game-control onClick={this.prevTip} className="queue-tips-arrow prev">
                    ◀
                </button>
                <button type="button" data-game-control onClick={this.nextTip} className="queue-tips-arrow next">
                    ▶
                </button>
            </div>
        );
    }
}