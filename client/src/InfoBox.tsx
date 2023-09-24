// InfoBox.tsx
import { h, Component } from 'preact';
import Description from './Description';

interface InfoBoxProps {
  action: any;
}

class InfoBox extends Component<InfoBoxProps> {
  render() {
    const { action } = this.props;
    return (
      <div>
        <div className="info-box-title">{action.name}</div>
        <div className="info-box-desc">{action.description}</div>
        <Description action={action} />
      </div>
    );
  }
}

export default InfoBox;