import { h, Component } from "preact";
import "./Modal.style.css";

interface ModalProps {
  onClose: () => void;
  children: h.JSX.Element | h.JSX.Element[];
}

class Modal extends Component<ModalProps> {
  render(): h.JSX.Element {
    return (
      <div className="modal-overlay" onClick={this.props.onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={this.props.onClose}>
            ×
          </button>
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default Modal;
