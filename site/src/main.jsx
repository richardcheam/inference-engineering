import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles.css';
import './design-system.css';
import './motion.css';
import './editorial.css';
import './adaptive.css';
import './home.css';
import './scene.css';
import './canvas.css';
import './playback.css';
import './sequence.css';
import './masthead.css';
import './search.css';
import './division-field.css';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
