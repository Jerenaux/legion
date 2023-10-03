// import { h, Component } from 'preact';

// import Button from './Button';

// class LandingPage extends Component {
//     state = {
//         user: null,
//     };

//     unregisterAuthObserver: () => void;

//     componentDidMount() {
//         this.initFirebaseUI();
//         this.unregisterAuthObserver = firebase.auth().onAuthStateChanged(
//             (user) => this.setState({ user })
//         );
//     }

//     componentWillUnmount() {
//         this.unregisterAuthObserver();
//     }

//     initFirebaseUI() {
//         const uiConfig = {
//           signInSuccessUrl: '/play',
//           signInFlow: 'popup',
//           signInOptions: [
//             firebase.auth.GoogleAuthProvider.PROVIDER_ID,
//             firebase.auth.EmailAuthProvider.PROVIDER_ID,
//           ],
//         };
    
//         const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
//         ui.start('#firebaseui-auth-container', uiConfig);
//     }

//     render() {
//         return (
//             <div className="landing-page">
//                 <img className="logo" src="assets/legionlogo.png" alt="Logo" />
//                 {!this.state.user && <div id="firebaseui-auth-container"></div>}
//                 {this.state.user && <Button label="PLAY" to="/play" />}
//                 <div className="socials">
//                     <a href="https://twitter.com/iolegion" target="_blank" rel="noopener noreferrer">
//                         <img src="assets/twitter.png" alt="Twitter" />
//                     </a>
//                 </div>
//             </div>
//         );
//     }
// }

// export default LandingPage;