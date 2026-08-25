import { Component, type ReactNode } from 'react';
import { log } from '../utils/logger';

interface Props {
  children: ReactNode;
  /** Nombre del módulo/zona para el log (ej: 'Admin', 'Catalog', 'Home') */
  moduleName: string;
  /** UI de fallback personalizado (opcional) */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * ═══ ERROR BOUNDARY ═══
 * Captura errores de render de React y los muestra en consola
 * con contexto del módulo, sin crashpear toda la app.
 *
 * Uso:
 *   <ErrorBoundary moduleName="Admin">
 *     <Admin />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const componentStack = errorInfo.componentStack || '';
    this.setState({ errorInfo: componentStack });

    log.error(this.props.moduleName, `Render crash: ${error.message}`, {
      name: error.name,
      stack: error.stack,
      componentStack,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 m-4 rounded-xl border border-red-200 bg-red-50 text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <h3 className="text-sm font-bold text-red-800 mb-1">
            Error en {this.props.moduleName}
          </h3>
          <p className="text-xs text-red-600 mb-4 max-w-md">
            {this.state.error?.message || 'Error desconocido durante el renderizado'}
          </p>
          <details className="w-full max-w-md mb-4">
            <summary className="text-xs text-red-500 cursor-pointer hover:underline">
              Ver detalles del error
            </summary>
            <pre className="mt-2 text-[10px] text-red-700 bg-red-100 p-2 rounded-lg overflow-auto max-h-40 text-left whitespace-pre-wrap">
              {this.state.error?.stack}
              {this.state.errorInfo && `\n\nComponent Stack:\n${this.state.errorInfo}`}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
