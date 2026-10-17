import '../../src/i18n';
import '../../src/style/style.css';
import {h, render} from 'preact';
import AuthProvider from '../../src/providers/AuthProvider';
import AuthContext from '../../src/contexts/AuthContext';
import {firebaseAuth} from '../../src/services/firebaseService';

// Observe real SDK completion even when AuthProvider correctly keeps children hidden.
firebaseAuth.onAuthStateChanged(user => {
  document.documentElement.dataset.firebaseUser = user?.uid || '';
});
if (location.search === '?seed') {
  // Seed real Firebase persistence, then reload into the actual startup flow.
  void firebaseAuth.signInWithCustomToken('local-test-token');
} else render(<AuthProvider><AuthContext.Consumer>{({user}) =>
  <main id="authenticated" data-user={user?.uid} />
}</AuthContext.Consumer></AuthProvider>, document.getElementById('root')!);
