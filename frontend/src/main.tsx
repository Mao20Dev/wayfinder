import React from 'react'
import ReactDOM from 'react-dom/client'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { MotionConfig } from 'motion/react'
import App from './App'
import './styles.css'

const theme = createTheme({
  palette: {
    primary: { main: '#225c4d' },
    background: { default: '#f5f6f8' },
    text: { primary: '#23352f', secondary: '#66756e' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>,
)
