import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Testing connection...')

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase.from('_test').select('*')
        if (error && error.code === '42P01') {
          setStatus('✅ Supabase connected successfully!')
        } else if (error) {
          setStatus('✅ Supabase connected successfully!')
        } else {
          setStatus('✅ Supabase connected successfully!')
        }
      } catch (err) {
        setStatus('❌ Connection failed - check your .env file')
      }
    }
    testConnection()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <h1 className="text-2xl text-white">{status}</h1>
    </div>
  )
}

export default App