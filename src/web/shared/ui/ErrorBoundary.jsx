import { Component } from 'react';
import { withTranslation } from 'react-i18next';

/**
 * Catches render errors so a bad row in the dashboard does not blank the whole SPA.
 */
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[EasyPages] UI error boundary', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    const { t, children } = this.props;
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="m-0 text-sm font-medium text-red-800">{t('ui_error_title')}</p>
          <p className="mt-2 mb-4 text-sm text-red-700">{t('ui_error_body')}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            {t('ui_error_retry')}
          </button>
        </div>
      );
    }
    return children;
  }
}

const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
export default ErrorBoundary;
