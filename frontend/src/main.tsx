import React from 'react';
import ReactDOM from 'react-dom/client';
import Console from './dcim/Console';
const Lab = React.lazy(() => import('./App'));
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('lab') ? <React.Suspense fallback="Loading thermal lab…"><a className="block bg-slate-900 px-6 py-2 text-sm text-white" href="/">← Campus operations</a><Lab /></React.Suspense> : <Console />}
  </React.StrictMode>
);
