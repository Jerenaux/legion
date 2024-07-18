import { h } from 'preact';
import { Route, Router } from 'preact-router';

import AuthProvider from './providers/AuthProvider';
import PlayerProvider from './providers/PlayerProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import LandingPage from './routes/LandingPage';
import withAuth from './components/withAuth';

const App = () => (
	<AuthProvider>
		<PlayerProvider>
			<div id="app">
				<Router>
					<Route default path="/" component={LandingPage} />
                    <Route path="/play" component={withAuth(HomePage)} />
                    <Route path="/game/:id" component={withAuth(GamePage)} />
				</Router>
			</div>
		</PlayerProvider>
	</AuthProvider>
);

export default App;
