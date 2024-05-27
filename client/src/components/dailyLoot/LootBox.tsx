import { h, Component } from 'preact';
import { ChestColor } from "@legion/shared/enums";

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
        case ChestColor.BRONZE:
            return "Bronze Chest";
        case ChestColor.SILVER:
            return "Silver Chest";
        case ChestColor.GOLD:
            return "Golden Chest";
        default:
            return "";
        }
    }

    getImageSrc() {
        const { color } = this.props;
        switch (color) {
        case ChestColor.BRONZE:
            return "/shop/bronze_chest.png";
        case ChestColor.SILVER:
            return "/shop/silver_chest.png";
        case ChestColor.GOLD:
            return "/shop/gold_chest.png";
        default:
            return "";
        }
    }

    computeTimeFields(timeInSeconds) {
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
                <div>
                Available in
                <span className="loot-box-countdown">
                    {`${hour}`.padStart(2, "0")}:
                    {`${minute}`.padStart(2, "0")}:
                    {`${second}`.padStart(2, "0")}
                </span>
                </div>
            );
        } else if (!ownsKey) {
            return (
                <div>
                <img src="/shop/silver_key_icon.png" alt="key icon" />
                <span className="loot-box-key">0 / 1</span>
                </div>
            );
        } else {
            return <span className="loot-box-open">Open</span>;
        }
    }

    render() {
        const { onClick } = this.props;
        return (
        <div className="lootBoxContainer" onClick={onClick}>
            <div className="loot-box-title"><span>{this.getTitle()}</span></div>
            <img className="loot-box-image" src={this.getImageSrc()} alt={this.props.color} />
            <div className="loot-box-footer">{this.getFooterContent()}</div>
        </div>
        );
    }
}

export default LootBox;
