import {h, render} from 'preact';
import AuthProvider from '../../src/providers/AuthProvider';
import AuthContext from '../../src/contexts/AuthContext';
import {firebaseAuth} from '../../src/services/firebaseService';

// Observe real SDK completion even when AuthProvider correctly keeps children hidden.
firebaseAuth.onAuthStateChanged(user => {
  document.documentElement.dataset.firebaseUser = user?.uid || '';
});
render(<AuthProvider><AuthContext.Consumer>{({user}) =>
  <main id="authenticated" data-user={user?.uid} />
}</AuthContext.Consumer></AuthProvider>, document.getElementById('root')!);
