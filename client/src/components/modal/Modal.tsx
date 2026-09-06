import { h, Component } from 'preact';
import './Modal.style.css';

interface ModalProps {
  onClose: () => void;
  children: h.JSX.Element | h.JSX.Element[];
}

class Modal extends Component<ModalProps> {
  render(): h.JSX.Element {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: The close button provides keyboard access; clicking the backdrop is a pointer convenience.
      <div className="modal-overlay" onClick={this.props.onClose}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: This handler only prevents backdrop click bubbling. */}
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={this.props.onClose}>×</button>
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default Modal;
