'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

export default function ActiveSessionsPage() {
  const router = useRouter()
  const [pendingSessions, setPendingSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteCode, setDeleteCode] = useState('')
  const [showDeleteInput, setShowDeleteInput] = useState<string | null>(null)

  useEffect(() => {
    fetchPendingSessions()
  }, [])

  const fetchPendingSessions = async () => {
    try {
      setLoading(true)
      // Find all pending sessions from the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      
      const { data, error } = await supabase
        .from('count_sessions')
        .select('*')
        .eq('status', 'pending')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending sessions:', error)
        toast.error('Failed to fetch active sessions')
        return
      }

      setPendingSessions(data || [])
    } catch (error) {
      console.error('Error in fetchPendingSessions:', error)
      toast.error('Failed to fetch active sessions')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string, participants: string[]) => {
    if (deleteCode !== '8989') {
      toast.error('Incorrect code')
      setDeleteCode('')
      return
    }

    if (!confirm(`Are you sure you want to DELETE this active session? This will remove the session and all associated counts. Participants: ${participants.join(', ')}`)) {
      setDeleteCode('')
      setShowDeleteInput(null)
      return
    }

    try {
      // Delete all counts for this session
      const { error: countsError } = await supabase
        .from('counts')
        .delete()
        .eq('session_id', sessionId)

      if (countsError) {
        console.error('Error deleting counts:', countsError)
      }

      // Delete the session
      const { error: sessionError } = await supabase
        .from('count_sessions')
        .delete()
        .eq('session_id', sessionId)

      if (sessionError) {
        console.error('Error deleting session:', sessionError)
        toast.error('Failed to delete session')
        return
      }

      toast.success('Active session deleted successfully')
      setDeleteCode('')
      setShowDeleteInput(null)
      fetchPendingSessions()
    } catch (error) {
      console.error('Error in handleDeleteSession:', error)
      toast.error('Failed to delete session')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl">Loading active sessions...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Toaster />
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Active Sessions</h1>
          <div className="flex gap-3">
            <button
              onClick={fetchPendingSessions}
              className="bg-blue-600 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-600 text-white px-6 py-3 text-lg font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Counter
            </button>
          </div>
        </div>

        {pendingSessions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-xl text-gray-600">No active sessions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSessions.map((session) => {
              const sessionDate = new Date(session.created_at)
              const timeStr = sessionDate.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })
              const dateStr = sessionDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
              
              return (
                <div key={session.session_id} className="bg-white border-2 border-gray-300 rounded-lg p-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900 mb-1">
                        {session.session_name ? (
                          <>
                            {session.session_name}
                            <span className="text-base font-normal text-gray-600 ml-2">
                              ({session.session_id})
                            </span>
                          </>
                        ) : (
                          `Session: ${session.session_id}`
                        )}
                      </p>
                      <p className="text-base text-gray-700">
                        <span className="font-semibold">Participants:</span>{' '}
                        {session.participants?.length > 0 
                          ? session.participants.join(', ')
                          : 'None'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Created: {dateStr} at {timeStr}
                      </p>
                    </div>
                    {showDeleteInput === session.session_id ? (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-1">Enter code to delete:</label>
                          <input
                            type="text"
                            value={deleteCode}
                            onChange={(e) => setDeleteCode(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleDeleteSession(session.session_id, session.participants || [])}
                            className="w-full px-3 py-2 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                            placeholder="Enter code"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteSession(session.session_id, session.participants || [])}
                          className="bg-red-600 text-white px-6 py-2 text-base font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteInput(null)
                            setDeleteCode('')
                          }}
                          className="bg-gray-600 text-white px-6 py-2 text-base font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteInput(session.session_id)}
                        className="w-full bg-red-600 text-white px-4 py-2 text-base font-semibold rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Delete Session
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}





