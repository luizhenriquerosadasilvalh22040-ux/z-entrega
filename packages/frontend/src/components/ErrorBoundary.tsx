import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card } from './ui';
import { Ban, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center p-8 space-y-6 border border-slate-100 dark:border-slate-800/80 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <Ban size={32} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">Ops! Algo deu errado</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ocorreu uma falha inesperada na renderização desta página. Mas não se preocupe, seus dados estão seguros!
              </p>
              {this.state.error && (
                <div className="bg-slate-50 dark:bg-slate-850/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-3 text-left">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">DETALHE DO ERRO</span>
                  <code className="text-[10px] text-red-500 font-mono break-all line-clamp-3">
                    {this.state.error.toString()}
                  </code>
                </div>
              )}
            </div>

            <div className="flex gap-3 flex-wrap sm:flex-nowrap">
              <Button 
                variant="outline" 
                fullWidth 
                onClick={this.handleReload}
                className="flex items-center gap-1.5 justify-center"
              >
                <RefreshCw size={15} /> Recarregar
              </Button>
              <Button 
                fullWidth 
                onClick={this.handleGoHome}
                className="flex items-center gap-1.5 justify-center"
              >
                <Home size={15} /> Ir para a Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.children;
  }
}
