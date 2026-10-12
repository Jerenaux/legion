import {t} from '../../i18n/core';

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
            <section className="queue-tips" aria-live="polite">
                <button type="button" data-game-control onClick={this.prevTip} className="queue-tips-arrow prev" aria-label={t("Previous")}>
                    <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true"><path d="M10 1 2 8l8 7z" fill="currentColor" /></svg>
                </button>
                <div className="queue-tips-container">
                    <h2 className="queue-tips-title">{t("Tips")}</h2>
                    <p className="queue-tips-text">
                        {this.state.tips[this.state.tipCount] && t(this.state.tips[this.state.tipCount])}
                    </p>
                </div>
                <button type="button" data-game-control onClick={this.nextTip} className="queue-tips-arrow next" aria-label={t("Next")}>
                    <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true"><path d="m2 1 8 7-8 7z" fill="currentColor" /></svg>
                </button>
            </section>
        );
    }
}