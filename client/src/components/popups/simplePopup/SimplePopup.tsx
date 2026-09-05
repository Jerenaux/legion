import { h, Component } from "preact";
import goldChestImage from "@assets/shop/gold_chest.png";
import "./SimplePopup.style.css";

interface Props {
  text: string;
  header?: string;
}

export class SimplePopup extends Component<Props> {
  render() {
    const { header, text } = this.props;
    return (
      <div className="simple-popup">
        <div className="simple-popup-content">
          <img src={goldChestImage} alt="Gold chest" className="simple-popup-icon" />
          <div className="simple-popup-text-container">
            {header && <h3 className="simple-popup-header">{header}</h3>}
            <p className="simple-popup-text" dangerouslySetInnerHTML={{ __html: text }} />
          </div>
        </div>
      </div>
    );
  }
}
