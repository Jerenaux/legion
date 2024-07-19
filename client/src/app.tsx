import { h } from 'preact';
import { useContext, useEffect } from 'preact/hooks';
import { Route, Router } from 'preact-router';
import { route } from 'preact-router';

import AuthProvider from './providers/AuthProvider';
import AuthContext from './contexts/AuthContext';
import PlayerProvider from './providers/PlayerProvider';
import HomePage from './routes/HomePage';
import GamePage from './routes/GamePage';
import LandingPage from './routes/LandingPage';
import withAuth from './components/withAuth';

const App = () => (
    <AuthProvider>
		<PlayerProvider>
			<div id="app">
				<AuthBasedRouting />
			</div>
		</PlayerProvider>
    </AuthProvider>
);

const AuthBasedRouting = () => {
    const { isAuthenticated, isLoading } = useContext(AuthContext);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            route('/play', true); // Redirect to /play if authenticated
        }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
        return <div>Loading...</div>; // Show a loading spinner or similar
    }

    return (
        <Router>
            <Route default path="/" component={isAuthenticated ? withAuth(HomePage) : LandingPage} />
            <Route path="/game/:id" component={withAuth(GamePage)} />
        </Router>
    );
};

export default App;
