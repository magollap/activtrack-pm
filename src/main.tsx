import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { ToastProvider } from '@/hooks/useToast';
import { InstallPromptProvider } from '@/hooks/useInstallPrompt';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/hooks/useTheme';
import { selectBackend } from '@/lib/backend';
import { errorMessage } from '@/lib/errors';
import './index.css';

const root = createRoot(document.getElementById('root')!);

selectBackend()
  .then(() => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <InstallPromptProvider>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </InstallPromptProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    root.render(
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center text-sm text-slate-600 dark:text-slate-300">
        <p className="max-w-sm">{errorMessage(error)}</p>
      </div>,
    );
  });
