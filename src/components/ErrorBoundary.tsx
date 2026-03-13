import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  private isAuthRelated(): boolean {
    const msg = (this.state.error?.message || '').toLowerCase();
    return /jwt|token|unauthorized|401|auth|session/i.test(msg);
  }

  private handleGoToLogin = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
    window.location.replace('/');
  };

  render() {
    if (this.state.hasError) {
      const isAuth = this.isAuthRelated();
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <CardTitle>{isAuth ? 'Session expired' : 'Something went wrong'}</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {isAuth
                  ? 'Your session has expired. Please log in again.'
                  : 'An unexpected error occurred. Please try again.'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => this.setState({ hasError: false, error: undefined })}>
                  Try Again
                </Button>
                {isAuth && (
                  <Button variant="outline" onClick={this.handleGoToLogin}>
                    Go to Login
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
