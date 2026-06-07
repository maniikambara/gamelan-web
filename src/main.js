import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error(`Vue error [${info}]:`, err)
}

// Warn about unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

try {
  app.mount('#app')
  console.log('✓ Vue app mounted successfully')
} catch (err) {
  console.error('✗ Failed to mount Vue app:', err)
  // Show error in DOM as fallback
  const app = document.getElementById('app')
  if (app) {
    app.innerHTML = `<div style="padding: 2rem; color: red; font-family: monospace;">
      <h2>Kesalahan Aplikasi</h2>
      <p>${err.message}</p>
      <pre>${err.stack}</pre>
    </div>`
  }
}
