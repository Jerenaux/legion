// Button.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface ButtonProps {
    to: string;
    label: string;
  }

class Button extends Component<ButtonProps> {
  handleClick = () => {
    route(this.props.to);
  }

  render() {
    return (
      <div className="button-container button" onClick={this.handleClick}>
        {this.props.label}
      </div>
    );
  }
}

export default Button;