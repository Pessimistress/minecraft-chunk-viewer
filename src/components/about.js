import React, {PureComponent} from 'react';

export default class About extends PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  _open = () => {
    this.setState({isOpen: true});
  }

  _close = () => {
    this.setState({isOpen: false});
  }

  render() {
    return (
      <div>
        <div className="about-btn" onClick={this._open}>i</div>

        <div className={`modal-bg ${this.state.isOpen ? 'active' : ''}`} onClick={this._close} >
          <div className="modal">
            <p>Drag and drop your own <i>.mca</i> file into this window to visualize!</p>
            <hr />
            <p>I don't own Minecraft or any of its content, nor do I profit from them, 
              otherwise I would be living on Beverly Hills.<sup>*</sup></p>
            <p>This is a WIP project that I build for fun in my spare time. 
              I am not responsible for false diamonds, underrepresented species or death from falling. 
              Missing features and bugs are plenty. Come bite me 
              on <a href="https://github.com/Pessimistress/minecraft-chunk-viewer">Github</a>. </p>
            <p><small>* Actually. I still wouldn't want to live on Beverly Hills.</small></p>
          </div>
        </div>
      </div>
    );
  }
}
