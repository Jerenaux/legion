import { h } from 'preact';
import { Route, Router } from 'preact-router';

import AuthProvider from './providers/AuthProvider';
import PlayerProvider from './providers/PlayerProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import withAuth from './components/withAuth';
import TeamPage from './components/TeamPage';

// import {GameAnalytics} from 'gameanalytics';

// GameAnalytics.setEnabledInfoLog(true);
// GameAnalytics.setEnabledVerboseLog(true);
// GameAnalytics.initialize("7c5228298402ef1ac167a99534731837", "45aafee0b1b3655a5b4ca96a106332cc817990c2");

const App = () => (
	<AuthProvider>
		<PlayerProvider>
			<div id="app">
				<Router>
					<Route default path="/" component={HomePage} />
					<Route path="/game/:id" component={GamePage} />
					{/* <Route path="/team/:id?" component={withAuth(TeamPage)} /> */}
				</Router>
			</div>
		</PlayerProvider>
	</AuthProvider>
);

export default App;
