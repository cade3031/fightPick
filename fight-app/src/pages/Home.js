// preview-start
import * as React from 'react';
import { AppProvider } from '@toolpad/core/AppProvider';
import { SignInPage } from '@toolpad/core/SignInPage';
import { useTheme } from '@mui/material/styles';
import './Home.css';

// preview-start
const providers = [{ id: 'credentials', name: 'Email and Password' }];
// preview-end

const signIn = async (provider, formData) => {
  const promise = new Promise((resolve) => {
    setTimeout(() => {
      alert(
        `Signing in with "${provider.name}" and credentials: ${formData.get('email')}, ${formData.get('password')}`,
      );
      resolve();
    }, 300);
  });
  return promise;
};

function Home() {
  const theme = useTheme();
  return (
    // preview-start
    <AppProvider theme={theme}>
      <SignInPage signIn={signIn} providers={providers} />
    </AppProvider>
    // preview-end
  );
}

export default Home;