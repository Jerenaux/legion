import {t, i18n} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';

import { h } from 'preact';
import { Component } from 'preact';
import { ChestColor } from "@legion/shared/enums";

// Explicit imports for chest images
import bronzeChestImage from '@assets/shop/bronze_chest.png';
import silverChestImage from '@assets/shop/silver_chest.png';
import goldChestImage from '@assets/shop/gold_chest.png';

// Import for the key icon
import silverKeyIcon from '@assets/shop/silver_key_icon.png';

interface LootBoxProps {
    color: ChestColor;
    timeRemaining: number;
    ownsKey: boolean;
    onClick: () => void;
}

interface LootBoxState {
    timeRemaining: number;
}

class LootBox extends Component<LootBoxProps, LootBoxState> {
    interval: NodeJS.Timeout;

    constructor(props: LootBoxProps) {
        super(props);
        this.state = {
            timeRemaining: props.timeRemaining,
        };
    }

    componentDidMount() {
        this.startInterval();
    }

    componentWillUnmount() {
        this.clearInterval();
    }

    componentDidUpdate(prevProps: LootBoxProps) {
        if (prevProps.timeRemaining !== this.props.timeRemaining) {
            this.setState({ timeRemaining: this.props.timeRemaining });
            this.clearInterval();
            this.startInterval();
        }
    }

    startInterval() {
        this.interval = setInterval(() => {
            this.setState((prevState) => {
                if (prevState.timeRemaining > 0) {
                    return { timeRemaining: prevState.timeRemaining - 1 };
                } else {
                    this.clearInterval();
                    return { timeRemaining: 0 };
                }
            });
        }, 1000);
    }

    clearInterval() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    getTitle() {
        const { color } = this.props;
        switch (color) {
            case ChestColor.BRONZE: return t("Bronze Chest");
            case ChestColor.SILVER: return t("Silver Chest");
            case ChestColor.GOLD: return t("Golden Chest");
            default: return "";
        }
    }

    getImageSrc() {
        const { color } = this.props;
        switch (color) {
            case ChestColor.BRONZE: return bronzeChestImage;
            case ChestColor.SILVER: return silverChestImage;
            case ChestColor.GOLD: return goldChestImage;
            default: return "";
        }
    }

    computeTimeFields(timeInSeconds: number) {
        const hour = Math.floor(timeInSeconds / 3600);
        const minute = Math.floor((timeInSeconds % 3600) / 60);
        const second = Math.round(timeInSeconds % 60);
        return { hour, minute, second };
    }

    getFooterContent() {
        const { ownsKey } = this.props;
        const { timeRemaining } = this.state;

        if (timeRemaining > 0) {
            const { hour, minute, second } = this.computeTimeFields(timeRemaining);
            return (
                <div><Trans i18n={i18n} i18nKey={"Available in<0>{{value0}}:{{value1}}:{{value2}}</0>"} components={[<span className="loot-box-countdown" />]} values={{value0: `${hour}`.padStart(2, "0"), value1: `${minute}`.padStart(2, "0"), value2: `${second}`.padStart(2, "0")}} /></div>
            );
        } else if (!ownsKey) {
            return (
                <div>
                    <img src={silverKeyIcon} alt={t("key icon")} />
                    <span className="loot-box-key">0 / 1</span>
                </div>
            );
        } else {
            return <span className="loot-box-open">{t("Open")}</span>;
        }
    }

    render() {
        const { onClick } = this.props;
        return (
            <button type="button" data-game-control className="lootBoxContainer" onClick={onClick}>
                <div className="loot-box-title"><span>{this.getTitle()}</span></div>
                <img className="loot-box-image" src={this.getImageSrc()} alt="" />
                <div className="loot-box-footer">{this.getFooterContent()}</div>
            </button>
        );
    }
}

export default LootBox;